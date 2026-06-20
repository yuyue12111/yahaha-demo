"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 收藏书签按钮（POST /api/games/:id/favorite 切换，乐观更新）。
 * 卡片上叠加用 tone="overlay"；Play 控制栏用 tone="control"。在卡片里点按不触发卡片跳转。
 */
export function BookmarkButton({
  gameId,
  initialFavorited,
  tone = "overlay",
  refreshOnToggle = false,
}: {
  gameId: string;
  initialFavorited: boolean;
  tone?: "overlay" | "control";
  /** /me Favorites 页：切换后刷新列表。 */
  refreshOnToggle?: boolean;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const prev = fav;
    setFav(!fav);
    try {
      const res = await fetch(`/api/games/${gameId}/favorite`, { method: "POST" });
      if (res.status === 401) {
        // 会话过期 → 别静默回滚，引导重新登录（回到当前页）。
        setFav(prev);
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(`/login?next=${next}`);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { favorited: boolean };
      setFav(d.favorited);
      if (refreshOnToggle) router.refresh();
    } catch {
      setFav(prev);
    } finally {
      setBusy(false);
    }
  };

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
      <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
