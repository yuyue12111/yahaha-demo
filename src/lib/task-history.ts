import { prisma } from "./db";
import type { TaskStatus } from "./contracts/tasks";

/**
 * 当前用户的生成任务历史（加分项：生成任务历史）。最近 N 条，含关联游戏标题/发布态，
 * 供 /me「生成记录」tab 渲染（状态徽章 + 创意 + 时间 + 失败重试 / 查看产物）。
 */
export type TaskHistoryItem = {
  id: string;
  status: TaskStatus;
  prompt: string;
  createdAt: string;
  gameId: string | null;
  gameTitle: string | null;
  gamePublished: boolean;
  modelProvider: string | null;
  attempt: number;
};

export async function listRecentTasks(userId: string, limit = 30): Promise<TaskHistoryItem[]> {
  const rows = await prisma.generationTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { game: { select: { id: true, title: true, status: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    status: t.status as TaskStatus,
    prompt: t.prompt,
    createdAt: t.createdAt.toISOString(),
    gameId: t.gameId,
    gameTitle: t.game?.title ?? null,
    gamePublished: t.game?.status === "PUBLISHED",
    modelProvider: t.modelProvider ?? null,
    attempt: t.attempt,
  }));
}
