import { prisma } from "../db";
import { env } from "../env";
import { getModelClient } from "../model";
import { publishTaskEvent } from "../events";
import { toLogDTO } from "../task-serialize";
import type { AgentName } from "../contracts/tasks";
import type { RuntimeKind } from "../contracts/runtime";
import { runIngest } from "./ingest";
import { runPlanner } from "./planner";
import { runAssetCurator } from "./asset-curator";
import { runCoder } from "./coder";
import { runValidator } from "./validator";
import { runPackager } from "./packager";
import type { AgentContext, AssetRef, NodeResult } from "./types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 生成编排器（docs/04 状态机）。INGEST→PLANNER→ASSET_CURATOR→CODER→VALIDATOR→PACKAGER。
 * 每节点：更新 currentStep + 发 step(start) → 跑 → 写 AgentLog(seq,IO,latency) + 发 log + step(end)。
 * 整任务受 GENERATION_TIMEOUT_MS 看护（防卡 RUNNING）；任一节点抛错 → FAILED + 失败节点 ERROR 日志。
 * 这是规避红线④（异步多步非黑盒）的核心：worker 进程内逐步、可观测、有独立 IO。
 */
export async function runGeneration(taskId: string): Promise<void> {
  const task = await prisma.generationTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`GenerationTask ${taskId} 不存在`);

  const model = getModelClient();
  const ctx: AgentContext = {
    taskId,
    userId: task.userId,
    gameId: task.gameId,
    prompt: task.prompt,
    assetIds: task.inputAssetIds,
    seedKey: `${task.prompt}|${[...task.inputAssetIds].sort().join(",")}`,
    model,
  };

  const assetRows = ctx.assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: ctx.assetIds } } })
    : [];
  const assetRefs: AssetRef[] = assetRows.map((a) => ({
    assetId: a.id,
    key: a.s3Key,
    contentType: a.contentType,
  }));

  await prisma.generationTask.update({
    where: { id: taskId },
    data: { status: "RUNNING", startedAt: new Date(), modelProvider: model.provider, error: null },
  });
  await publishTaskEvent(taskId, { event: "status", data: { status: "RUNNING", currentStep: null } });

  let seq = 0;
  async function step<T>(
    agent: AgentName,
    title: string,
    fn: () => Promise<NodeResult<T>>,
  ): Promise<T> {
    seq += 1;
    const mySeq = seq;
    await prisma.generationTask.update({ where: { id: taskId }, data: { currentStep: agent } });
    await publishTaskEvent(taskId, {
      event: "step",
      data: { agentName: agent, seq: mySeq, title, state: "start", level: "INFO" },
    });
    await delay(360 + mySeq * 60); // 让 pending/running 窗口可观测（不影响产物字节）
    const t0 = Date.now();
    const result = await fn();
    const latencyMs = Date.now() - t0;
    const log = await prisma.agentLog.create({
      data: {
        taskId,
        seq: mySeq,
        agentName: agent,
        level: "INFO",
        title,
        inputSummary: result.inputSummary,
        outputSummary: result.outputSummary,
        tokensIn: result.tokensIn ?? null,
        tokensOut: result.tokensOut ?? null,
        latencyMs,
      },
    });
    await publishTaskEvent(taskId, { event: "log", data: toLogDTO(log) });
    await publishTaskEvent(taskId, {
      event: "step",
      data: { agentName: agent, seq: mySeq, title, state: "end", level: "INFO" },
    });
    return result.output;
  }

  const pipeline = async () => {
    const ingest = await step("INGEST", "归一多模态输入", () => runIngest(ctx, assetRefs));
    const spec = await step("PLANNER", "产出 GameSpec", () => runPlanner(ctx, ingest));
    await step("ASSET_CURATOR", "规划素材映射", () => runAssetCurator(ctx, spec, assetRefs));
    const coder = await step("CODER", "生成可玩 bundle", () => runCoder(ctx, spec));
    const validation = await step("VALIDATOR", "静态校验产物", () => runValidator(ctx, coder));
    const pkg = await step("PACKAGER", "打包上传+写版本", () =>
      runPackager(ctx, spec, coder, validation),
    );

    await prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: "SUCCEEDED",
        currentStep: null,
        finishedAt: new Date(),
        gameId: pkg.gameId,
        resultVersionId: pkg.versionId,
      },
    });
    await publishTaskEvent(taskId, {
      event: "status",
      data: { status: "SUCCEEDED", currentStep: null },
    });
    await publishTaskEvent(taskId, {
      event: "done",
      data: {
        status: "SUCCEEDED",
        versionId: pkg.versionId,
        gameId: pkg.gameId,
        versionNumber: pkg.versionNumber,
        runtime: pkg.runtime as RuntimeKind,
        manifestUrl: pkg.manifestUrl,
        entryUrl: pkg.entryUrl,
      },
    });
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`生成超时：${env.GENERATION_TIMEOUT_MS}ms 未完成`)),
      env.GENERATION_TIMEOUT_MS,
    );
    timer.unref?.();
  });

  try {
    await Promise.race([pipeline(), watchdog]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cur = await prisma.generationTask.findUnique({
      where: { id: taskId },
      select: { currentStep: true },
    });
    const failedAgent = cur?.currentStep ?? null;
    if (failedAgent) {
      seq += 1;
      const log = await prisma.agentLog.create({
        data: {
          taskId,
          seq,
          agentName: failedAgent,
          level: "ERROR",
          title: `${failedAgent} 失败`,
          inputSummary: null,
          outputSummary: message.slice(0, 500),
        },
      });
      await publishTaskEvent(taskId, { event: "log", data: toLogDTO(log) });
    }
    await prisma.generationTask.update({
      where: { id: taskId },
      data: { status: "FAILED", finishedAt: new Date(), error: message.slice(0, 1000) },
    });
    await publishTaskEvent(taskId, {
      event: "status",
      data: { status: "FAILED", currentStep: failedAgent },
    });
    await publishTaskEvent(taskId, {
      event: "done",
      data: { status: "FAILED", error: message.slice(0, 500) },
    });
    throw err; // 让 BullMQ 记 job failed（attempts:1，不自动重跑有副作用的流水线）
  } finally {
    if (timer) clearTimeout(timer);
  }
}
