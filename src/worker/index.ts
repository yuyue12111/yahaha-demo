import { Worker } from "bullmq";
import { env } from "../lib/env";
import { QUEUE_NAME, GENERATION_JOB, connection, type GenerationJobData } from "../lib/queue";
import { runGeneration } from "../lib/agents/runner";

/**
 * 独立 worker 进程 —— 消费 BullMQ `generation` 队列，跑 6 节点 Agent 状态机。
 * 这是规避红线④的"独立 worker 进程"：与 web 不同进程，202 入队后由它异步消费。
 * compose 用 `target: builder` + `pnpm tsx src/worker/index.ts` 起（与 seed 服务同范式）。
 * 连接用 queue.ts 导出的选项对象（bullmq 自建 ioredis 连接）。
 */
const worker = new Worker<GenerationJobData>(
  QUEUE_NAME,
  async (job) => {
    if (job.name !== GENERATION_JOB) return;
    const { taskId } = job.data;
    console.log(`[worker] ▶ task=${taskId} job=${job.id}`);
    await runGeneration(taskId);
    console.log(`[worker] ✓ task=${taskId}`);
  },
  { connection, concurrency: env.WORKER_CONCURRENCY },
);

worker.on("failed", (job, err) =>
  console.error(`[worker] ✗ task=${job?.data?.taskId} ${err?.message ?? err}`),
);
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
