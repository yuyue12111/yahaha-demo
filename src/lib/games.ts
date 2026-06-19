import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { GameCard } from "./contracts/games";

/**
 * 已发布游戏列表 — Home（RSC）与 GET /api/games 共用这一个 DB 查询，
 * 避免 RSC 自调自己的 API。"Home 查库非写死" 的证明就在这次 findMany（docs/03:30 全契约）。
 */
export type GamesSort = "newest" | "popular";
export type ListGamesParams = {
  search?: string;
  tag?: string;
  sort?: GamesSort;
  cursor?: string;
  limit?: number;
};

export async function listPublishedGames(
  params: ListGamesParams = {},
): Promise<{ items: GameCard[]; nextCursor?: string }> {
  const limit = Math.min(Math.max(params.limit ?? 24, 1), 60);

  const where: Prisma.GameWhereInput = { status: "PUBLISHED" };
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { summary: { contains: params.search, mode: "insensitive" } },
    ];
  }
  if (params.tag) where.tags = { has: params.tag };

  // id 作次级稳定序，保证游标分页确定（docs/03:30 sort=newest|popular）
  const orderBy: Prisma.GameOrderByWithRelationInput[] =
    params.sort === "popular"
      ? [{ playCount: "desc" }, { id: "asc" }]
      : [{ publishedAt: "desc" }, { id: "asc" }];

  const rows = await prisma.game.findMany({
    where,
    include: { author: { select: { id: true, displayName: true } } },
    orderBy,
    take: limit + 1, // 多取一条判断是否还有下一页
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items: GameCard[] = page.map((g) => ({
    id: g.id,
    title: g.title,
    summary: g.summary,
    coverUrl: g.coverUrl,
    tags: g.tags,
    author: { id: g.author.id, displayName: g.author.displayName },
    publishedAt: g.publishedAt ? g.publishedAt.toISOString() : null,
    playCount: g.playCount,
  }));

  return { items, nextCursor: hasMore ? page[page.length - 1].id : undefined };
}
