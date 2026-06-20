"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 点赞按钮（POST /api/games/:id/like 切换，乐观更新 + 服务端真计数回填）。
 * 详情页用：♥ + 计数胶囊。未登录点击 → 引导回登录（带 next 回跳）。
 */
export function LikeButton({
  gameId,
  initialLiked,
  initialCount,
}: {
  gameId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const prevLiked = liked;
    const prevCount = count;
    // 乐观更新
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));
    try {
      const res = await fetch(`/api/games/${gameId}/like`, { method: "POST" });
      if (res.status === 401) {
        setLiked(prevLiked);
        setCount(prevCount);
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(`/login?next=${next}`);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { liked: boolean; likes: number };
      setLiked(d.liked);
      setCount(d.likes); // 服务端真计数回填（消除并发漂移）
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "取消点赞" : "点赞"}
      title={liked ? "取消点赞" : "点赞"}
      className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong px-3 py-1.5 font-mono text-[12px] tabular-nums transition-colors hover:text-ink disabled:opacity-60"
      style={{ color: liked ? "var(--brand-magenta)" : "var(--text-muted)" }}
      disabled={busy}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
      {count}
    </button>
  );
}
