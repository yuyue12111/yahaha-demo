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

/** Home 三排（参考稿 Astrocade 式）：玩家之选 / Trending / 为你推荐，都从真实数据派生。 */

/** 玩家之选 = 累计游玩数最高（真实 playCount）。 */
export async function listPopularGames(limit = 12): Promise<GameCard[]> {
  const { items } = await listPublishedGames({ sort: "popular", limit });
  return items;
}

/**
 * Trending = 近 7 天「增长最快」：按最近 LOAD 事件数降序（真实 PlayEvent），playCount 兜底。
 * 真实「增长速度」信号，而非写死。
 */
export async function listTrendingGames(limit = 12): Promise<GameCard[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [{ items }, recent] = await Promise.all([
    listPublishedGames({ limit: 60 }),
    prisma.playEvent.groupBy({
      by: ["gameId"],
      where: { type: "LOAD", createdAt: { gte: since } },
      _count: { gameId: true },
    }),
  ]);
  const recentMap = new Map(recent.map((r) => [r.gameId, r._count.gameId]));
  return [...items]
    .sort((a, b) => (recentMap.get(b.id) ?? 0) - (recentMap.get(a.id) ?? 0) || b.playCount - a.playCount)
    .slice(0, limit);
}

/**
 * 为你推荐 = 确定性打散（按 id 稳定 hash 排序，区别于热门/趋势两排的次序）。
 * 无个性化推荐引擎时的诚实占位：一个稳定、可复现、与其它两排不同的次序。
 */
export async function listRecommendedGames(limit = 12): Promise<GameCard[]> {
  const { items } = await listPublishedGames({ limit: 60 });
  const hash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h >>> 0;
  };
  return [...items].sort((a, b) => hash(a.id) - hash(b.id)).slice(0, limit);
}

/**
 * 已发布游戏的去重标签 + 计数（标签筛选 / 详情用）。按出现次数降序，名称升序兜底。
 */
export async function listPublishedTags(limit = 8): Promise<{ tag: string; count: number }[]> {
  const rows = await prisma.game.findMany({
    where: { status: "PUBLISHED" },
    select: { tags: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
