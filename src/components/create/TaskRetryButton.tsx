"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 生成记录里失败任务的重试按钮（POST /api/tasks/:id/retry，仅本人+仅 FAILED）。
 * 成功 202 → 刷新列表（任务转 PENDING 重排）。引导用户去 Create 看实时进度。
 */
export function TaskRetryButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/retry`, { method: "POST" });
      if (res.status === 401) {
        router.push("/login?next=/me?tab=tasks");
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setErr(j?.error?.message ?? `重试失败 ${res.status}`);
        return;
      }
      router.refresh();
    } catch {
      setErr("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="rounded-pill border border-hairline-strong px-3 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
      >
        {busy ? "重排中…" : "重试"}
      </button>
      {err ? <span className="text-[11px] text-danger">{err}</span> : null}
    </span>
  );
}
