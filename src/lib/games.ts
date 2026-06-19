import { prisma } from "./db";
import type { GameCard } from "./contracts/games";

/**
 * 已发布游戏列表 — Home（RSC）与 GET /api/games 共用这一个 DB 查询，
 * 避免 RSC 自调自己的 API（绝对 URL + 自调失败面）。"Home 查库非写死" 的证明就在这次 findMany。
 */
export async function listPublishedGames(limit = 60): Promise<GameCard[]> {
  const games = await prisma.game.findMany({
    where: { status: "PUBLISHED" },
    include: { author: { select: { id: true, displayName: true } } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return games.map((g) => ({
    id: g.id,
    title: g.title,
    summary: g.summary,
    coverUrl: g.coverUrl,
    tags: g.tags,
    author: { id: g.author.id, displayName: g.author.displayName },
    publishedAt: g.publishedAt ? g.publishedAt.toISOString() : null,
    playCount: g.playCount,
  }));
}
