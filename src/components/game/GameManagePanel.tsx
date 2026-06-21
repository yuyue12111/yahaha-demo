"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * 作者管理面板（T2-1 owner-scoped）：改 meta（标题/简介/标签）+ 下架/恢复 + 删除（含远端产物）。
 * 走 PATCH / POST archive / DELETE `/api/games/:id*`，成功后 router.refresh() 反映最新态。
 */
export function GameManagePanel({
  gameId,
  status,
  initial,
  publishVersionId = null,
}: {
  gameId: string;
  status: Status;
  initial: { title: string; summary: string; tags: string[] };
  /** 草稿的最新 version id：非空 + status=DRAFT → 显示「发布」按钮（设 activeVersionId → 可玩+进 Home）。 */
  publishVersionId?: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
  const dirty =
    title.trim() !== initial.title ||
    summary !== initial.summary ||
    tags.join(",") !== initial.tags.join(",");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const errOf = async (res: Response, fallback: string) =>
    (await res.json().catch(() => null))?.error?.message ?? `${fallback} ${res.status}`;

  const save = () =>
    run(async () => {
      if (!title.trim()) throw new Error("标题不能为空");
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), summary, tags }),
      });
      if (!res.ok) throw new Error(await errOf(res, "保存失败"));
      setMsg("已保存");
      router.refresh();
    });

  const publish = () =>
    run(async () => {
      if (!publishVersionId) throw new Error("没有可发布的版本");
      const res = await fetch(`/api/games/${gameId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId: publishVersionId }),
      });
      if (!res.ok) throw new Error(await errOf(res, "发布失败"));
      setMsg("已发布 —— 现在可在首页浏览并直接游玩");
      router.refresh();
    });

  const toggleArchive = () =>
    run(async () => {
      const archived = status !== "ARCHIVED";
      const res = await fetch(`/api/games/${gameId}/archive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error(await errOf(res, "操作失败"));
      setMsg(archived ? "已下架（首页不再显示）" : "已恢复");
      router.refresh();
    });

  const remove = () =>
    run(async () => {
      if (!window.confirm("确认删除该游戏？将一并删除全部版本与远端产物，不可恢复。")) return;
      const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errOf(res, "删除失败"));
      router.push("/");
      router.refresh();
    });

  return (
    <section className="rounded-lg border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink">管理（作者）</h2>
        <span className="font-mono text-[11px] text-ink-faint">{status}</span>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-muted">标题</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            disabled={busy}
            className="h-9 rounded-lg border border-hairline bg-surface-inset px-3 text-sm text-ink outline-none focus:border-hairline-strong"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-muted">简介</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={busy}
            className="resize-none rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-ink outline-none focus:border-hairline-strong"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-ink-muted">标签（逗号分隔，最多 8）</span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            disabled={busy}
            placeholder="arcade, dodge, neon"
            className="h-9 rounded-lg border border-hairline bg-surface-inset px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-hairline-strong"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* 草稿：一键发布最新版本 → 设 activeVersionId、进 Home、可 Play（修复"生成后无发布入口"缺口）。 */}
          {status === "DRAFT" && publishVersionId ? (
            <Button variant="primary" size="sm" onClick={() => void publish()} disabled={busy}>
              {busy ? "…" : "发布"}
            </Button>
          ) : null}
          <Button
            variant={status === "DRAFT" && publishVersionId ? "ghost" : "primary"}
            size="sm"
            onClick={() => void save()}
            disabled={busy || !dirty}
          >
            {busy ? "…" : "保存修改"}
          </Button>
          <Button variant="ghost" size="sm" href={`/create?gameId=${gameId}`}>
            生成新版本
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void toggleArchive()} disabled={busy}>
            {status === "ARCHIVED" ? "恢复上架" : "下架"}
          </Button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="ml-auto inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-danger transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] disabled:opacity-50"
          >
            删除游戏
          </button>
        </div>

        {msg ? <p className="text-[12px]" style={{ color: "var(--ok)" }}>{msg}</p> : null}
        {err ? <p className="text-[12px] text-danger">{err}</p> : null}
      </div>
    </section>
  );
}
