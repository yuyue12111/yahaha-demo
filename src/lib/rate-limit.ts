import IORedis from "ioredis";
import { env } from "./env";

/**
 * per-user 速率限额（docs/07 §5）—— Redis 固定窗口计数器。
 * 第一次命中设 TTL=窗口长度；窗口内累加；超过上限 → 拒绝并给出 retryAfter。
 * **fail-open**：Redis 不可用时放行（限额是防滥用增强，绝不因它拖垮正常用户）。
 */
let client: IORedis | null = null;
function getClient(): IORedis {
  if (!client) {
    client = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    client.on("error", (e) => console.error("[rate-limit] redis error:", e.message));
  }
  return client;
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSec: number };

export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<RateLimitResult> {
  try {
    const redis = getClient();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    if (count > max) {
      const ttl = await redis.ttl(key);
      return { allowed: false, remaining: 0, retryAfterSec: ttl > 0 ? ttl : windowSec };
    }
    return { allowed: true, remaining: Math.max(0, max - count), retryAfterSec: 0 };
  } catch (e) {
    console.error("[rate-limit] check failed (fail-open):", (e as Error).message);
    return { allowed: true, remaining: max, retryAfterSec: 0 };
  }
}

/** 新建生成任务的 per-user 限额（POST /api/tasks）。 */
export function rateLimitCreateTask(userId: string): Promise<RateLimitResult> {
  return checkRateLimit(`ratelimit:tasks:${userId}`, env.RATE_LIMIT_TASKS, env.RATE_LIMIT_WINDOW_SEC);
}

/** 公开埋点端点限额（POST /api/play-events）——按 (session uid | client IP) 防刷 playCount。 */
export function rateLimitPlayEvents(clientKey: string): Promise<RateLimitResult> {
  return checkRateLimit(
    `ratelimit:playevents:${clientKey}`,
    env.RATE_LIMIT_PLAY_EVENTS,
    env.RATE_LIMIT_WINDOW_SEC,
  );
}
