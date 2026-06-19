import IORedis from "ioredis";
import { env } from "./env";
import { TaskEvent } from "./contracts/tasks";

/**
 * 任务进度事件总线（Redis pub/sub）—— worker 进程 publish，SSE 路由 subscribe 中继。
 * docs/08：worker → Redis pub/sub → SSE(`/api/tasks/:id/stream`) → Create run-timeline。
 * 解耦 web/worker 两进程，且 SSE 端永远能用 `GET /api/tasks/:id` 重建状态（pub/sub 仅体验增强）。
 */
const channel = (taskId: string) => `task:${taskId}`;

let publisher: IORedis | null = null;
function getPublisher(): IORedis {
  if (!publisher) {
    publisher = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    publisher.on("error", (e) => console.error("[events] publisher error:", e.message));
  }
  return publisher;
}

/** worker 侧：发布一条任务事件。失败只记录、不抛（SSE 是增强，挂了不能拖垮流水线）。 */
export async function publishTaskEvent(taskId: string, event: TaskEvent): Promise<void> {
  try {
    await getPublisher().publish(channel(taskId), JSON.stringify(event));
  } catch (e) {
    console.error("[events] publish failed:", (e as Error).message);
  }
}

/**
 * SSE 侧：订阅某任务的事件。每个 SSE 连接用独立的 subscriber 连接（pub/sub 连接进订阅模式后
 * 不能再发普通命令）。返回 cleanup（done 或客户端断连时调用）；`signal` abort 也会自动清理。
 */
export function subscribeTaskEvents(
  taskId: string,
  onEvent: (e: TaskEvent) => void,
  signal: AbortSignal,
): () => void {
  const sub = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  sub.on("error", (e) => console.error("[events] subscriber error:", e.message));
  void sub.subscribe(channel(taskId));
  sub.on("message", (_ch, msg) => {
    try {
      const parsed = TaskEvent.safeParse(JSON.parse(msg));
      if (parsed.success) onEvent(parsed.data);
    } catch {
      /* malformed message — ignore */
    }
  });
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    void sub.quit().catch(() => sub.disconnect());
  };
  signal.addEventListener("abort", cleanup, { once: true });
  return cleanup;
}
