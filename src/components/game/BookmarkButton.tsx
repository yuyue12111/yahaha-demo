"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 收藏书签按钮（POST /api/games/:id/favorite 切换，乐观更新）。
 * 卡片上叠加用 tone="overlay"；Play 控制栏用 tone="control"。在卡片里点按不触发卡片跳转。
 * 传 `count` → 渲染为 [★ 计数] 胶囊并随切换活更新（详情页用）；不传 → 纯图标（卡片/Play，行为不变）。
 */
export function BookmarkButton({
  gameId,
  initialFavorited,
  tone = "overlay",
  refreshOnToggle = false,
  count,
}: {
  gameId: string;
  initialFavorited: boolean;
  tone?: "overlay" | "control";
  /** /me Favorites 页：切换后刷新列表。 */
  refreshOnToggle?: boolean;
  /** 提供则进入计数胶囊模式（详情页）。 */
  count?: number;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initialFavorited);
  const [favCount, setFavCount] = useState(count ?? 0);
  const [busy, setBusy] = useState(false);
  const withCount = count !== undefined;

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const prev = fav;
    const prevCount = favCount;
    setFav(!fav);
    if (withCount) setFavCount(prevCount + (prev ? -1 : 1));
    try {
      const res = await fetch(`/api/games/${gameId}/favorite`, { method: "POST" });
      if (res.status === 401) {
        // 会话过期 → 别静默回滚，引导重新登录（回到当前页）。
        setFav(prev);
        if (withCount) setFavCount(prevCount);
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(`/login?next=${next}`);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { favorited: boolean; favorites?: number };
      setFav(d.favorited);
      if (withCount && typeof d.favorites === "number") setFavCount(d.favorites);
      if (refreshOnToggle) router.refresh();
    } catch {
      setFav(prev);
      if (withCount) setFavCount(prevCount);
    } finally {
      setBusy(false);
    }
  };

  const icon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </svg>
  );

  // 计数胶囊模式（详情页）：[★ 计数]，颜色随收藏态。
  if (withCount) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={fav}
        title={fav ? "取消收藏" : "收藏"}
        aria-label={fav ? "取消收藏" : "收藏"}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong px-3 py-1.5 font-mono text-[12px] tabular-nums transition-colors hover:text-ink disabled:opacity-60"
        style={{ color: fav ? "var(--warn)" : "var(--text-muted)" }}
      >
        {icon}
        {favCount}
      </button>
    );
  }

  const base =
    tone === "overlay"
      ? "absolute right-2 top-2 z-[2] grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-black/45 backdrop-blur-sm transition-colors hover:bg-black/65"
      : "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-hairline-strong transition-colors hover:text-ink";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={fav}
      title={fav ? "取消收藏" : "收藏"}
      aria-label={fav ? "取消收藏" : "收藏"}
      className={base}
      style={{ color: fav ? "var(--warn)" : tone === "overlay" ? "#fff" : "var(--text-muted)" }}
    >
      {icon}
    </button>
  );
}
