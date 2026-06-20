import Link from "next/link";
import { listPublishedGames, type GamesSort } from "@/lib/games";
import { GameCard } from "@/components/game/GameCard";

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
  const sort: GamesSort = sp.sort === "popular" ? "popular" : "newest";

  const { items: games } = await listPublishedGames({ search, tag, sort });

  // 构造保留当前筛选的 URL（用于排序切换 / 清除 chip）。
  const hrefWith = (next: { search?: string; tag?: string; sort?: GamesSort }) => {
    const p = new URLSearchParams();
    if (next.search) p.set("search", next.search);
    if (next.tag) p.set("tag", next.tag);
    if (next.sort && next.sort !== "newest") p.set("sort", next.sort);
    const q = p.toString();
    return q ? `/?${q}` : "/";
  };

  const sortTab = (key: GamesSort, label: string) => (
    <Link
      href={hrefWith({ search, tag, sort: key })}
      aria-current={sort === key ? "page" : undefined}
      className={`rounded-pill px-3 py-1 text-[13px] transition-colors ${
        sort === key
          ? "bg-surface-2 font-medium text-ink"
          : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-ink">发现游戏</h1>
        <p className="mt-1 text-sm text-ink-muted">社区发布的 AI 互动游戏，点击即玩。</p>
      </div>

      {/* 搜索 + 排序（GET 表单 → RSC 重渲染，无需客户端 JS）。 */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form method="get" className="flex items-center gap-2">
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="搜索标题或简介…"
            aria-label="搜索游戏"
            className="h-9 w-full max-w-xs rounded-lg border border-hairline bg-surface-inset px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-hairline-strong sm:w-64"
          />
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          {sort === "popular" ? <input type="hidden" name="sort" value="popular" /> : null}
          <button
            type="submit"
            className="h-9 shrink-0 rounded-lg border border-hairline-strong px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            搜索
          </button>
        </form>
        <div className="flex items-center gap-1">
          {sortTab("newest", "最新")}
          {sortTab("popular", "最热")}
        </div>
      </div>

      {/* 生效中的筛选 chip（可清除）。 */}
      {search || tag ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
          {search ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface-inset px-2.5 py-1 text-ink-muted">
              搜索：{search}
              <Link href={hrefWith({ tag, sort })} aria-label="清除搜索" className="text-ink-faint hover:text-danger">
                ✕
              </Link>
            </span>
          ) : null}
          {tag ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface-inset px-2.5 py-1 text-ink-muted">
              标签：{tag}
              <Link href={hrefWith({ search, sort })} aria-label="清除标签" className="text-ink-faint hover:text-danger">
                ✕
              </Link>
            </span>
          ) : null}
        </div>
      ) : null}

      {games.length === 0 ? (
        <p className="text-ink-muted">
          {search || tag ? (
            <>
              没有匹配的游戏。{" "}
              <Link href="/" className="text-ink underline-offset-2 hover:underline">
                清除筛选
              </Link>
            </>
          ) : (
            "还没有已发布的游戏。"
          )}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
