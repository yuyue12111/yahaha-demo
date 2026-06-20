import Link from "next/link";
import type { GameCard as GameCardData } from "@/lib/contracts/games";
import { BookmarkButton } from "./BookmarkButton";

/**
 * 游戏卡（参考稿 Astrocade 式，简洁版）：竖版 3:4 封面满铺 + 左下 play-count 徽章 +
 * （登录态）右上收藏书签；卡下标题 + 作者行。完整字段见详情页 /games/[id]。
 * 封面是 MinIO `:9000` 跨域图（img-src 未被站点 CSP 限）。
 */

// 无封面时的程序化渐变占位（参考稿彩色卡片观感）；按 id 确定性取色，异游戏异渐变。
const COVER_FALLBACKS = [
  "linear-gradient(150deg,#C03BFF,#3B82F6)",
  "linear-gradient(160deg,#F6B73C,#FF5C7A)",
  "linear-gradient(135deg,#5DE2B0,#27E0FF)",
  "linear-gradient(150deg,#FF3BA7,#C03BFF)",
];
function coverFallback(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COVER_FALLBACKS[Math.abs(h) % COVER_FALLBACKS.length];
}

function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function GameCard({
  game,
  showBookmark = false,
  favorited = false,
  refreshOnToggle = false,
}: {
  game: GameCardData;
  /** 登录态 → 显示收藏书签。 */
  showBookmark?: boolean;
  favorited?: boolean;
  refreshOnToggle?: boolean;
}) {
  const initial = game.author.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-hairline-brand bg-surface-inset shadow-[0_8px_20px_-12px_rgba(0,0,0,.6)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:-translate-y-1.5 group-hover:shadow-[0_14px_36px_-8px_rgba(192,59,255,.5)]">
        {game.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 跨域 MinIO 封面，刻意不用 next/image
          <img
            src={game.coverUrl}
            alt={game.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full" style={{ background: coverFallback(game.id) }} aria-hidden />
        )}
        {/* 整封面可点 → Play（覆盖层，让书签按钮叠在更上层） */}
        <Link href={`/play/${game.id}`} aria-label={game.title} className="absolute inset-0 z-[1]" />
        <span className="pointer-events-none absolute bottom-2 left-2 z-[1] inline-flex items-center gap-1 rounded-pill bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          ▶ {formatPlays(game.playCount)}
        </span>
        {showBookmark ? (
          <BookmarkButton gameId={game.id} initialFavorited={favorited} refreshOnToggle={refreshOnToggle} />
        ) : null}
      </div>

      <Link href={`/play/${game.id}`} className="block">
        <h3 className="mt-2.5 truncate text-[15px] font-bold text-ink transition-colors group-hover:text-brand-cyan">
          {game.title}
        </h3>
      </Link>

      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-medium text-ink-muted"
          aria-hidden
        >
          {initial}
        </span>
        <span className="truncate text-[13px] text-ink-muted">{game.author.displayName}</span>
      </div>
    </div>
  );
}
