import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  listPublishedGames,
  listPopularGames,
  listTrendingGames,
  listRecommendedGames,
  getFavoriteIds,
} from "@/lib/games";
import { GameCard } from "@/components/game/GameCard";
import { GameRow } from "@/components/game/GameRow";
import type { GameCard as GameCardData } from "@/lib/contracts/games";

// 查库渲染（非写死数组）；force-dynamic 避免 build 期触 DB。
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; tag?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const tag = sp.tag?.trim() || undefined;
  const popularView = sp.sort === "popular";

  const session = await auth();
  const loggedIn = !!session?.user;
  const favoritedIds = loggedIn ? await getFavoriteIds(session!.user!.id) : [];
  const favSet = new Set(favoritedIds);

  // 搜索 / 标签 / 排行 → 单网格视图
  if (search || tag) {
    const { items } = await listPublishedGames({ search, tag });
    return (
      <ResultGrid
        title={search ? `“${search}” 的结果` : `#${tag}`}
        count={items.length}
        games={items}
        empty="没有匹配的游戏。"
        showBookmark={loggedIn}
        favSet={favSet}
      />
    );
  }
  if (popularView) {
    const items = await listPopularGames(60);
    return (
      <ResultGrid title="排行榜 · 玩的人最多" count={items.length} games={items} empty="还没有游戏。" showBookmark={loggedIn} favSet={favSet} />
    );
  }

  // 默认 = 三排发现（参考稿 Astrocade 式，可左右拖动）
  const [popular, trending, recommended] = await Promise.all([
    listPopularGames(12),
    listTrendingGames(12),
    listRecommendedGames(12),
  ]);

  if (popular.length === 0) {
    return (
      <div className="mx-auto max-w-6xl rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
        <p className="text-ink-muted">
          还没有已发布的游戏。{" "}
          <Link href="/create" className="text-brand-cyan underline-offset-2 hover:underline">
            用 AI 创作第一个 →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px]">
      <GameRow title="Players' Choice" games={popular} size="lg" showBookmark={loggedIn} favoritedIds={favoritedIds} />
      <GameRow title="Trending" games={trending} showBookmark={loggedIn} favoritedIds={favoritedIds} />
      <GameRow title="Recommended For You" games={recommended} showBookmark={loggedIn} favoritedIds={favoritedIds} />
    </div>
  );
}

function ResultGrid({
  title,
  count,
  games,
  empty,
  showBookmark = false,
  favSet,
}: {
  title: string;
  count: number;
  games: GameCardData[];
  empty: string;
  showBookmark?: boolean;
  favSet: Set<string>;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="truncate text-[18px] font-extrabold text-ink">{title}</h2>
        {count > 0 ? (
          <Link href="/" className="shrink-0 text-[13px] text-brand-cyan transition-opacity hover:opacity-80">
            返回发现
          </Link>
        ) : null}
      </div>
      {games.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-ink-muted">
            {empty}{" "}
            <Link href="/" className="text-brand-cyan underline-offset-2 hover:underline">
              返回发现
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {games.map((g) => (
            <GameCard key={g.id} game={g} showBookmark={showBookmark} favorited={favSet.has(g.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
