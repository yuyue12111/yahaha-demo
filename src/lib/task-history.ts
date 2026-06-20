import { prisma } from "./db";
import { env } from "./env";
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
  /** 生成成本统计（加分项）：该任务 6 节点 AgentLog 的 token 总量（in+out）。 */
  totalTokens: number;
};

export async function listRecentTasks(userId: string, limit = 30): Promise<TaskHistoryItem[]> {
  const rows = await prisma.generationTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      game: { select: { id: true, title: true, status: true } },
      logs: { select: { tokensIn: true, tokensOut: true } },
    },
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
    totalTokens: t.logs.reduce((s, l) => s + (l.tokensIn ?? 0) + (l.tokensOut ?? 0), 0),
  }));
}

/** token → 估算美元成本（env COST_USD_PER_1K_TOKENS，默认 0.01/1k）。mock token 为估算值，故成本亦为估算。 */
export function estimateCostUsd(totalTokens: number): number {
  return (totalTokens / 1000) * env.COST_USD_PER_1K_TOKENS;
}
