"use client";

import { useRef } from "react";
import { GameCard } from "./GameCard";
import type { GameCard as GameCardData } from "@/lib/contracts/games";

/**
 * 横向游戏排（参考稿 Astrocade/Poki 式）：标题 + 副标 + 可左右拖动的卡片轨。
 * 鼠标按住拖动滚动（拖动中取消卡片点击）；触屏走原生横向滚动；左右箭头按钮翻页。
 */
export function GameRow({
  title,
  subtitle,
  games,
  size = "sm",
}: {
  title: string;
  subtitle?: string;
  games: GameCardData[];
  /** lg = 主打排（玩家之选）更大卡；sm = 次级排（Trending/推荐）。 */
  size?: "lg" | "sm";
}) {
  const cardW = size === "lg" ? "w-[178px] sm:w-[212px]" : "w-[138px] sm:w-[160px]";
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return; // 触屏交给原生滚动
    const el = ref.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !drag.current.down) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };
  const endDrag = () => {
    drag.current.down = false;
  };
  // 拖动后抑制卡片点击（避免拖到一半误触发跳转）。
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };
  const scrollByDir = (dir: number) => ref.current?.scrollBy({ left: dir * 560, behavior: "smooth" });

  if (games.length === 0) return null;

  return (
    <section className="mb-9">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[12px] text-ink-faint">{subtitle}</p> : null}
        </div>
        <div className="hidden shrink-0 gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            aria-label="向左滚动"
            className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            aria-label="向右滚动"
            className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </header>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        className="yh-noscrollbar flex cursor-grab gap-4 overflow-x-auto pb-1 active:cursor-grabbing"
      >
        {games.map((g) => (
          <div key={g.id} className={`${cardW} shrink-0`}>
            <GameCard game={g} />
          </div>
        ))}
      </div>
    </section>
  );
}
