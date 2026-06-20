import Link from "next/link";
import { listPublishedGames, listPublishedTags, type GamesSort } from "@/lib/games";
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

  const [{ items: games }, tags] = await Promise.all([
    listPublishedGames({ search, tag, sort }),
    listPublishedTags(),
  ]);

  // 构造保留当前筛选的 URL（用于排序切换 / 标签 / 清除）。
  const hrefWith = (next: { search?: string; tag?: string; sort?: GamesSort }) => {
    const p = new URLSearchParams();
    if (next.search) p.set("search", next.search);
    if (next.tag) p.set("tag", next.tag);
    if (next.sort && next.sort !== "newest") p.set("sort", next.sort);
    const q = p.toString();
    return q ? `/?${q}` : "/";
  };

  const sortTab = (key: GamesSort, label: string) => {
    const active = sort === key;
    return (
      <Link
        href={hrefWith({ search, tag, sort: key })}
        aria-current={active ? "page" : undefined}
        className={`rounded-pill px-3 py-1.5 text-[13px] transition-colors ${
          active ? "bg-ink font-semibold text-bg" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };

  const sectionTitle = search
    ? `“${search}” 的结果`
    : tag
      ? `#${tag}`
      : sort === "popular"
        ? "最热门"
        : "为你精选";

  return (
    <div className="mx-auto max-w-6xl">
      {/* 顶部行：搜索 + 排序切换（GET 表单 → RSC 重渲染，无需客户端 JS） */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form method="get" className="relative w-full sm:flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="搜索游戏、作者、标签…"
            aria-label="搜索游戏"
            className="h-11 w-full rounded-md border border-hairline bg-surface pl-10 pr-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.025)] outline-none placeholder:text-ink-faint focus:border-hairline-strong"
          />
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          {sort === "popular" ? <input type="hidden" name="sort" value="popular" /> : null}
        </form>
        <div className="flex shrink-0 items-center gap-1 rounded-pill border border-hairline bg-surface p-1">
          {sortTab("newest", "最新")}
          {sortTab("popular", "最热")}
        </div>
      </div>

      {/* 分类筛选 pill 行（真实去重标签，替代写死分类）。 */}
      {tags.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link
            href={hrefWith({ search, sort })}
            aria-current={!tag ? "page" : undefined}
            className={`rounded-pill px-3.5 py-1.5 text-[13px] transition-colors ${
              !tag ? "bg-ink font-semibold text-bg" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            全部
          </Link>
          {tags.map(({ tag: t }) => {
            const active = tag === t;
            return (
              <Link
                key={t}
                href={hrefWith({ search, tag: t, sort })}
                aria-current={active ? "page" : undefined}
                className={`rounded-pill px-3.5 py-1.5 text-[13px] transition-colors ${
                  active ? "bg-ink font-semibold text-bg" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {t}
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* 区块标题 + 数量 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="truncate text-[18px] font-extrabold text-ink">{sectionTitle}</h2>
        <span className="shrink-0 font-mono text-[11px] text-ink-faint">{games.length} 款</span>
      </div>

      {games.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-ink-muted">
            {search || tag ? (
              <>
                没有匹配的游戏。{" "}
                <Link href="/" className="text-brand-cyan underline-offset-2 hover:underline">
                  清除筛选
                </Link>
              </>
            ) : (
              <>
                还没有已发布的游戏。{" "}
                <Link href="/create" className="text-brand-cyan underline-offset-2 hover:underline">
                  用 AI 创作第一个 →
                </Link>
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
