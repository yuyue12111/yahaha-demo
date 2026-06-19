import { Worker } from "bullmq";
import { env } from "../lib/env";
import { QUEUE_NAME, GENERATION_JOB, connection, type GenerationJobData } from "../lib/queue";
import { runGeneration } from "../lib/agents/runner";
import { failTaskIfRunning, reapAbandonedRunningTasks, reapOrphanGames } from "../lib/reaper";

/**
 * 独立 worker 进程 —— 消费 BullMQ `generation` 队列，跑 6 节点 Agent 状态机。
 * 这是规避红线④的"独立 worker 进程"：与 web 不同进程，202 入队后由它异步消费。
 * compose 用 `target: builder` + `pnpm tsx src/worker/index.ts` 起（与 seed 服务同范式）。
 */
async function main() {
  // 启动回收（MED-5）：先扫掉上个 worker 崩溃遗留的 RUNNING 孤儿 + 零-version DRAFT 孤儿，再开 Worker。
  const reaped = await reapAbandonedRunningTasks();
  const orphans = await reapOrphanGames();
  if (reaped || orphans) {
    console.log(`[worker] reaper: ${reaped} stale-RUNNING→FAILED · ${orphans} orphan DRAFT removed`);
  }

  const worker = new Worker<GenerationJobData>(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== GENERATION_JOB) return;
      const { taskId } = job.data;
      console.log(`[worker] ▶ task=${taskId} job=${job.id}`);
      await runGeneration(taskId);
      console.log(`[worker] ✓ task=${taskId}`);
    },
    // maxStalledCount:0 —— worker 崩溃后该 job 直接判 failed（不重投/不双跑有副作用的流水线，
    // 与 attempts:1 同一意图）；恢复由 failed 事件 + 启动 reaper 收口为 FAILED，确定性、不卡 RUNNING。
    { connection, concurrency: env.WORKER_CONCURRENCY, maxStalledCount: 0 },
  );

  // MED-5：任何 job 失败（含 worker 崩溃后 BullMQ 判定的 stalled）→ 幂等转 FAILED（runner 已设则 no-op）。
  worker.on("failed", async (job, err) => {
    const taskId = job?.data?.taskId;
    console.error(`[worker] ✗ task=${taskId} ${err?.message ?? err}`);
    if (taskId) {
      // 不静默吞错：DB/事件失败要可见（启动 reaper 仍是最终安全网，但失败应被记录而非掩盖）。
      await failTaskIfRunning(taskId, `job failed: ${err?.message ?? err}`).catch((e) =>
        console.error(`[worker] failTaskIfRunning(${taskId}) errored:`, e?.message ?? e),
      );
    }
  });
  worker.on("error", (err) => console.error("[worker] worker error:", err.message));

  console.log(
    `[worker] up · queue=${QUEUE_NAME} · concurrency=${env.WORKER_CONCURRENCY} · model=${env.MODEL_PROVIDER}`,
  );

  async function shutdown(sig: string) {
    console.log(`[worker] ${sig} → draining…`);
    await worker.close();
    process.exit(0);
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
