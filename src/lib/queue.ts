import { Queue, type ConnectionOptions } from "bullmq";
import { env } from "./env";

/**
 * BullMQ 生成队列 —— `POST /api/tasks` 入队、独立 worker 进程消费（src/worker/index.ts）。
 * 这是规避红线④（同步单次黑盒）的队列层：请求侧只 `add` 后立即 202，绝不在请求里跑流水线。
 *
 * 连接以**选项对象**给 BullMQ（而非 ioredis 实例）：bullmq 自带嵌套 ioredis 副本，传实例会撞类型；
 * 给 host/port，让 bullmq 用自己的 ioredis 建连。pub/sub（events.ts）则用顶层 ioredis，互不干扰。
 *
 * 重试语义（docs/08）：job 级 `attempts: 1`（不自动重跑整条流水线 —— PACKAGER 有建库副作用，
 * 自动重跑会产重复 Game/Version）。模型坏输出走**节点内**有限修复重试；用户显式重试走 retry 路由（新 job）。
 */
export const QUEUE_NAME = "generation";
export const GENERATION_JOB = "generate";
export type GenerationJobData = { taskId: string };

const redisUrl = new URL(env.REDIS_URL);
export const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: redisUrl.port ? Number(redisUrl.port) : 6379,
  ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
  ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
  maxRetriesPerRequest: null, // BullMQ 要求阻塞连接为 null
};

export const generationQueue = new Queue(QUEUE_NAME, { connection });

export async function enqueueGeneration(taskId: string): Promise<void> {
  await generationQueue.add(
    GENERATION_JOB,
    { taskId } satisfies GenerationJobData,
    { attempts: 1, removeOnComplete: 200, removeOnFail: 500 },
  );
}
