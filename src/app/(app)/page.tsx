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

  const sortTab = (key: GamesSort, label: string) => {
    const active = sort === key;
    return (
      <Link
        href={hrefWith({ search, tag, sort: key })}
        aria-current={active ? "page" : undefined}
        className={`rounded-pill px-3.5 py-1.5 text-[13px] transition-colors ${
          active ? "bg-ink font-semibold text-bg" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* hero */}
      <div className="relative mb-6">
        <div
          className="pointer-events-none absolute -top-10 left-0 h-40 w-80 opacity-60"
          style={{ background: "radial-gradient(60% 60% at 30% 0%, rgba(124,92,255,.16), transparent 70%)" }}
          aria-hidden
        />
        <h1 className="relative text-[26px] font-extrabold tracking-tight text-ink">发现游戏</h1>
        <p className="relative mt-1 text-sm text-ink-muted">社区发布的 AI 互动游戏，点击即玩。</p>
      </div>

      {/* 搜索 + 排序（GET 表单 → RSC 重渲染，无需客户端 JS）。 */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form method="get" className="relative w-full sm:max-w-sm">
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
            placeholder="搜索游戏标题或简介…"
            aria-label="搜索游戏"
            className="h-10 w-full rounded-lg border border-hairline bg-surface-inset pl-10 pr-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.02)] outline-none placeholder:text-ink-faint focus:border-hairline-strong"
          />
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          {sort === "popular" ? <input type="hidden" name="sort" value="popular" /> : null}
        </form>
        <div className="flex shrink-0 items-center gap-1 rounded-pill border border-hairline bg-surface p-1">
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

      {/* section heading */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold text-ink">
          {search || tag ? "筛选结果" : sort === "popular" ? "最热门" : "最新发布"}
        </h2>
        <span className="font-mono text-[11px] text-ink-faint">{games.length} 款</span>
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
