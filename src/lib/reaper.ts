import { prisma } from "./db";
import { publishTaskEvent } from "./events";

/**
 * 失败恢复回收（MED-5）。in-process watchdog 随 worker 进程死，无法覆盖「worker 崩溃 → 任务永久卡 RUNNING」。
 * 这里补两条出口：① BullMQ stalled/failed 事件 → failTaskIfRunning；② worker 启动时扫掉上个进程遗留的 RUNNING。
 * 都幂等：已终态的任务不动。让 retry（需 FAILED）始终有 UI 出口。
 */

/** 把仍 PENDING/RUNNING 的任务幂等转 FAILED + 发 SSE 事件。已终态返回 false（不覆盖更丰富的失败记录）。 */
export async function failTaskIfRunning(taskId: string, reason: string): Promise<boolean> {
  const res = await prisma.generationTask.updateMany({
    where: { id: taskId, status: { in: ["PENDING", "RUNNING"] } },
    data: { status: "FAILED", error: reason.slice(0, 1000), finishedAt: new Date() },
  });
  if (res.count === 0) return false;
  const t = await prisma.generationTask.findUnique({
    where: { id: taskId },
    select: { currentStep: true },
  });
  await publishTaskEvent(taskId, {
    event: "status",
    data: { status: "FAILED", currentStep: t?.currentStep ?? null },
  });
  await publishTaskEvent(taskId, {
    event: "done",
    data: { status: "FAILED", error: reason.slice(0, 500) },
  });
  return true;
}

/**
 * worker 启动回收：单-worker 拓扑下，刚启动的 worker 见到的任何 RUNNING 任务都是上个 worker 崩溃遗留的孤儿
 * （优雅重启会先 drain 完，不留 RUNNING）。全部转 FAILED → 不永久卡 RUNNING。**须在 new Worker() 之前调用**，
 * 避开与本进程新任务的竞态。多副本场景应改用 BullMQ stalled 检测，不在此反查（当前 compose 单 worker）。
 */
export async function reapAbandonedRunningTasks(): Promise<number> {
  const abandoned = await prisma.generationTask.findMany({
    where: { status: "RUNNING" },
    select: { id: true },
  });
  let n = 0;
  for (const t of abandoned) {
    if (await failTaskIfRunning(t.id, "worker 重启：上一个 worker 中途退出，任务被回收为 FAILED")) n++;
  }
  return n;
}

/** 清理零-version 的 DRAFT 孤儿 Game（MED-4 历史残留 / 任何异常路径的兜底）。 */
export async function reapOrphanGames(): Promise<number> {
  const orphans = await prisma.game.findMany({
    where: { status: "DRAFT", versions: { none: {} } },
    select: { id: true },
  });
  if (orphans.length === 0) return 0;
  const res = await prisma.game.deleteMany({ where: { id: { in: orphans.map((g) => g.id) } } });
  return res.count;
}
