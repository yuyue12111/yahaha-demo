import Link from "next/link";
import type { GameCard as GameCardData } from "@/lib/contracts/games";

/**
 * 游戏卡（docs/10:63 §Game card + docs/00:33 / 02 / 03 的六项契约）：
 * 竖版 3:4 封面满铺 + border-brand，左下 play-count 徽章；卡下六项 ——
 * 标题 · 简介(截断) · 标签(pill) · 作者行(头像+名) · 发布时间。
 * 封面是 MinIO `:9000` 跨域图（img-src 未被站点 CSP 限）。
 */
export function GameCard({ game }: { game: GameCardData }) {
  const initial = game.author.displayName.trim().charAt(0).toUpperCase() || "?";
  // 确定性格式化（纯字符串切片，避免 toLocaleDateString 的 server/client 水合不一致）
  const publishedDate = game.publishedAt ? game.publishedAt.slice(0, 10) : null;

  return (
    <Link href={`/play/${game.id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-hairline-brand bg-surface-inset">
        {game.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 跨域 MinIO 封面，刻意不用 next/image
          <img
            src={game.coverUrl}
            alt={game.title}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-grad-play opacity-30" aria-hidden />
        )}
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-pill bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
          ▶ {game.playCount}
        </span>
      </div>

      <h3 className="mt-2 truncate text-[15px] font-bold text-ink">{game.title}</h3>

      {game.summary ? (
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-muted">{game.summary}</p>
      ) : null}

      {game.tags.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {game.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-pill border border-hairline px-2 py-0.5 text-[11px] text-ink-muted"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-medium text-ink-muted"
            aria-hidden
          >
            {initial}
          </span>
          <span className="truncate text-[13px] text-ink-muted">{game.author.displayName}</span>
        </span>
        {publishedDate ? (
          <time className="shrink-0 text-[11px] text-ink-faint" dateTime={game.publishedAt ?? undefined}>
            {publishedDate}
          </time>
        ) : null}
      </div>
    </Link>
  );
}
