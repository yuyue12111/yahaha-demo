import Link from "next/link";
import type { GameCard as GameCardData } from "@/lib/contracts/games";

/**
 * 游戏卡（docs/10 §Game card）：竖版 3:4 封面满铺 + border-brand，左下 play-count 徽章，
 * 卡下标题 15/700 + 作者行。封面是 MinIO `:9000` 跨域图（img-src 未被站点 CSP 限）。
 */
export function GameCard({ game }: { game: GameCardData }) {
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
      <p className="mt-0.5 truncate text-[13px] text-ink-muted">{game.author.displayName}</p>
    </Link>
  );
}
