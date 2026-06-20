"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { YForkLogo } from "@/components/brand/Logo";
import type { AgentLogDTO, AgentName, TaskStatus, TaskDoneData } from "@/lib/contracts/tasks";
import { PreviewPane } from "./PreviewPane";

/** 6 节点链（docs/04），固定顺序渲染 run-timeline。 */
const NODES: { name: AgentName; label: string; desc: string }[] = [
  { name: "INGEST", label: "Ingest", desc: "归一多模态输入" },
  { name: "PLANNER", label: "Planner", desc: "产出 GameSpec" },
  { name: "ASSET_CURATOR", label: "Asset Curator", desc: "规划素材映射" },
  { name: "CODER", label: "Coder", desc: "生成可玩 bundle" },
  { name: "VALIDATOR", label: "Validator", desc: "静态校验产物" },
  { name: "PACKAGER", label: "Packager", desc: "打包上传+写版本" },
];

// 参考稿用短标签 chip（太空躲避/霓虹跑酷/塔防），点按填入完整创意。
const EXAMPLES: { label: string; prompt: string }[] = [
  { label: "太空躲避", prompt: "一个太空主题的躲避小游戏，霓虹风格，越玩越快。" },
  { label: "霓虹跑酷", prompt: "赛博朋克跑酷，自动奔跑＋跳跃躲障碍，节奏感强。" },
  { label: "接星星", prompt: "接住坠落星星的休闲小游戏，漏接三次结束。" },
];

type NodeState = "pending" | "running" | "done" | "failed";
type UploadItem = { assetId: string; name: string; type: string; getUrl: string };

const STATE_COLOR: Record<NodeState, string> = {
  pending: "var(--canceled)",
  running: "var(--running)",
  done: "var(--ok)",
  failed: "var(--danger)",
};
// 参考稿节点状态胶囊用语
const STATE_LABEL: Record<NodeState, string> = {
  pending: "pending",
  running: "running",
  done: "succeeded",
  failed: "failed",
};

export function CreateStudio({
  regen = null,
}: {
  /** 非空 → 在已有游戏上生成新版本（提交带 gameId → packager 产 versionNumber+1）。 */
  regen?: { gameId: string; title: string } | null;
} = {}) {
  const [prompt, setPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState(""); // 已提交的创意 → 聊天用户气泡
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [runningAgent, setRunningAgent] = useState<AgentName | null>(null);
  const [logsByAgent, setLogsByAgent] = useState<Partial<Record<AgentName, AgentLogDTO>>>({});
  const [expanded, setExpanded] = useState<Partial<Record<AgentName, boolean>>>({});
  const [done, setDone] = useState<TaskDoneData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  useEffect(() => () => esRef.current?.close(), []);

  const busy = taskStatus === "PENDING" || taskStatus === "RUNNING";

  // ---- SSE：worker 经 Redis pub/sub 发的事件中继到这里（docs/03 §SSE）----
  const openStream = useCallback((id: string) => {
    esRef.current?.close();
    const es = new EventSource(`/api/tasks/${id}/stream`);
    esRef.current = es;
    es.addEventListener("status", (ev) => {
      setTaskStatus(JSON.parse((ev as MessageEvent).data).status);
    });
    es.addEventListener("step", (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as { agentName: AgentName; state: string };
      if (d.state === "start") setRunningAgent(d.agentName);
    });
    es.addEventListener("log", (ev) => {
      const log = JSON.parse((ev as MessageEvent).data) as AgentLogDTO;
      setLogsByAgent((m) => ({ ...m, [log.agentName]: log }));
      setRunningAgent((cur) => (cur === log.agentName ? null : cur));
    });
    es.addEventListener("done", (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as TaskDoneData;
      setDone(d);
      setTaskStatus(d.status);
      setRunningAgent(null);
      es.close();
    });
    es.onerror = () => {
      // 连接中断 → 轮询一次重建状态（SSE 仅增强，docs/03）。
      es.close();
      void fetch(`/api/tasks/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setTaskStatus(data.task.status);
          setLogsByAgent(
            Object.fromEntries((data.logs as AgentLogDTO[]).map((l) => [l.agentName, l])),
          );
        });
    };
  }, []);

  const resetRun = () => {
    setSubmitError(null);
    setDone(null);
    setLogsByAgent({});
    setExpanded({});
    setRunningAgent(null);
    setTaskStatus("PENDING");
    setPublished(false);
    setPublishError(null);
  };

  // ---- 发布：闭合 create→publish→Home（docs/03:33）----
  const publish = useCallback(async () => {
    if (!done?.gameId || !done.versionId || publishing) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/games/${done.gameId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId: done.versionId }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        throw new Error(e?.error?.message ?? `发布失败 ${res.status}`);
      }
      setPublished(true);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }, [done, publishing]);

  // ---- 上传：presign → 浏览器直传 MinIO（绝不经 app）----
  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const presign = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            bytes: file.size,
          }),
        });
        if (!presign.ok) {
          const e = await presign.json().catch(() => null);
          throw new Error(e?.error?.message ?? `presign 失败 ${presign.status}`);
        }
        const { assetId, putUrl, getUrl } = await presign.json();
        const put = await fetch(putUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error(`直传 MinIO 失败 ${put.status}`);
        setUploads((u) => [...u, { assetId, name: file.name, type: file.type, getUrl }]);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadBusy(false);
    }
  }, []);

  const removeUpload = (assetId: string) =>
    setUploads((u) => u.filter((x) => x.assetId !== assetId));

  // ---- 提交：POST /api/tasks → 202 立返 → 开 SSE ----
  const submit = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    resetRun();
    setSubmittedPrompt(prompt.trim());
    const sent = prompt.trim();
    setPrompt("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: sent,
          assetIds: uploads.map((u) => u.assetId),
          ...(regen ? { gameId: regen.gameId } : {}),
        }),
      });
      if (res.status !== 202) {
        const e = await res.json().catch(() => null);
        throw new Error(e?.error?.message ?? `提交失败 ${res.status}`);
      }
      const { taskId: id } = await res.json();
      setTaskId(id);
      openStream(id);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
      setTaskStatus("FAILED");
    }
  }, [prompt, uploads, busy, openStream, regen]);

  const retry = useCallback(async () => {
    if (!taskId) return;
    resetRun();
    const res = await fetch(`/api/tasks/${taskId}/retry`, { method: "POST" });
    if (res.status !== 202) {
      const e = await res.json().catch(() => null);
      setSubmitError(e?.error?.message ?? `重试失败 ${res.status}`);
      setTaskStatus("FAILED");
      return;
    }
    openStream(taskId);
  }, [taskId, openStream]);

  function nodeState(name: AgentName): NodeState {
    const log = logsByAgent[name];
    if (log?.level === "ERROR") return "failed";
    if (log) return "done";
    if (runningAgent === name) return "running";
    return "pending";
  }

  const failed = taskStatus === "FAILED";
  const succeeded = taskStatus === "SUCCEEDED";
  const hasConvo = !!taskId || submittedPrompt !== "" || failed;

  // B3：跨 6 节点聚合生成成本（mock 估算；确定性节点贡献 0）。
  const logVals = Object.values(logsByAgent);
  const hasTokens = logVals.some((l) => l?.tokensIn != null || l?.tokensOut != null);
  const tokenTotal = logVals.reduce(
    (acc, l) => ({ in: acc.in + (l?.tokensIn ?? 0), out: acc.out + (l?.tokensOut ?? 0) }),
    { in: 0, out: 0 },
  );

  const doneCount = NODES.filter((n) => nodeState(n.name) === "done").length;
  const progressPct = Math.round((doneCount / NODES.length) * 100);
  const statusPill = !taskStatus
    ? { text: "尚未开始", color: "var(--pending)", pulse: false }
    : failed
      ? { text: "失败", color: "var(--danger)", pulse: false }
      : succeeded
        ? { text: `完成 · ${doneCount}/6`, color: "var(--ok)", pulse: false }
        : { text: `运行中 · ${doneCount}/6`, color: "var(--running)", pulse: true };
  const assistantLine = failed
    ? "生成失败 —— 下面可以看到失败的节点，修复创意后重试。"
    : succeeded
      ? "搞定！六个节点都通过校验、bundle 已打包。下面可直接预览，满意就发布到首页 🎮"
      : "好的，我把这个点子跑成可玩原型。独立 worker 已异步启动 6 节点流水线，下面实时呈现 👇";
  const ctaText = busy ? "生成中…" : succeeded || failed ? "再生成" : "生成游戏";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-hairline"
        style={{
          background: "linear-gradient(180deg,#120E1C,#0B0912)",
          boxShadow: "0 40px 90px -34px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.05)",
        }}
      >
        {/* top bar */}
        <div
          className="flex items-center gap-3 border-b border-hairline px-5 py-4"
          style={{ background: "linear-gradient(180deg,rgba(255,255,255,.025),transparent)" }}
        >
          <YForkLogo size={32} />
          <div className="flex-1">
            <div className="text-[15px] font-extrabold leading-tight tracking-tight text-ink">Create</div>
            <div className="font-mono text-[11px] tracking-wide text-ink-faint">
              ai-worker · 6-node pipeline
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1 font-mono text-[11px]"
            style={{ color: statusPill.color, background: `color-mix(in srgb, ${statusPill.color} 14%, transparent)` }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusPill.pulse ? "yh-dotpulse" : ""}`}
              style={{ background: statusPill.color }}
            />
            {statusPill.text}
          </span>
        </div>

        {/* thread */}
        <div
          className="flex max-h-[600px] min-h-[340px] flex-col gap-6 overflow-y-auto px-6 py-7"
          style={{ background: "radial-gradient(120% 55% at 50% 0%, rgba(124,92,255,.06), transparent 62%)" }}
        >
          {!hasConvo ? (
            <div className="m-auto max-w-md py-6 text-center">
              <div className="mx-auto mb-4 w-fit">
                <YForkLogo size={54} float />
              </div>
              <div className="text-[20px] font-extrabold tracking-tight text-ink">把点子交给 YaHaHa</div>
              {regen ? (
                <div className="mt-4 rounded-lg border border-hairline-brand bg-surface-inset px-3 py-2 text-left text-[12px] text-ink-muted">
                  正在为《<span className="font-medium text-ink">{regen.title}</span>》生成新版本（v+1）
                </div>
              ) : (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setPrompt(ex.prompt)}
                      className="rounded-pill border border-hairline px-3.5 py-2 text-[12.5px] text-ink-muted transition-colors hover:border-hairline-brand hover:text-ink"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* user bubble */}
              {submittedPrompt ? (
                <div
                  className="max-w-[78%] self-end rounded-[18px_18px_6px_18px] border border-hairline-brand px-4 py-3 text-[14px] leading-snug text-ink"
                  style={{ background: "linear-gradient(135deg,#251C3D,#1A1430)" }}
                >
                  {submittedPrompt}
                </div>
              ) : null}

              {/* assistant: line + embedded pipeline card */}
              <div className="flex items-start gap-3">
                <YForkLogo size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-relaxed text-ink-muted">{assistantLine}</p>

                  <div className="mt-3 rounded-lg border border-hairline bg-surface-inset p-4">
                    {/* header + progress */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                        build pipeline
                      </span>
                      <span className="font-mono text-[11px] text-ink-faint">{doneCount} / 6</span>
                    </div>
                    <div className="mt-3 h-[3px] overflow-hidden rounded-pill bg-surface-2">
                      <div
                        className="h-full rounded-pill transition-[width] duration-500"
                        style={{
                          width: `${progressPct}%`,
                          background: "var(--grad-create)",
                          boxShadow: "0 0 10px rgba(39,224,255,.5)",
                        }}
                      />
                    </div>
                    {hasTokens ? (
                      <div className="mt-2 font-mono text-[11px] text-ink-faint">
                        Σ token 成本 · {tokenTotal.in} in / {tokenTotal.out} out ·{" "}
                        {tokenTotal.in + tokenTotal.out} tok
                      </div>
                    ) : null}

                    {/* 6-node vertical timeline */}
                    <ol className="mt-4 flex flex-col">
                      {NODES.map((node, i) => {
                        const st = nodeState(node.name);
                        const log = logsByAgent[node.name];
                        const last = i === NODES.length - 1;
                        const open = !!expanded[node.name] || st === "running";
                        return (
                          <li key={node.name} className="flex gap-3">
                            {/* badge + connector */}
                            <div className="flex flex-col items-center">
                              <span
                                key={st}
                                className="yh-pop grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
                                style={{
                                  color: STATE_COLOR[st],
                                  border: `1px solid color-mix(in srgb, ${STATE_COLOR[st]} 55%, transparent)`,
                                  background: `color-mix(in srgb, ${STATE_COLOR[st]} 12%, transparent)`,
                                  boxShadow:
                                    st === "running"
                                      ? "0 0 0 4px rgba(39,224,255,.1), 0 0 14px rgba(39,224,255,.32)"
                                      : undefined,
                                }}
                              >
                                {st === "running" ? (
                                  <span
                                    className="h-3 w-3 animate-spin rounded-full border-2 border-[rgba(39,224,255,.28)]"
                                    style={{ borderTopColor: "var(--running)" }}
                                    aria-hidden
                                  />
                                ) : st === "done" ? (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                ) : st === "failed" ? (
                                  "✕"
                                ) : (
                                  i + 1
                                )}
                              </span>
                              {!last ? (
                                <span
                                  className="my-1 w-px flex-1"
                                  style={{
                                    minHeight: 14,
                                    background:
                                      st === "done" ? "var(--grad-create)" : "var(--border)",
                                  }}
                                />
                              ) : null}
                            </div>
                            {/* body */}
                            <button
                              type="button"
                              onClick={() => setExpanded((m) => ({ ...m, [node.name]: !m[node.name] }))}
                              className="min-w-0 flex-1 pb-4 text-left"
                            >
                              {/* 行1：节点名 + 状态胶囊（参考稿） */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[13.5px] font-semibold text-ink">{node.label}</span>
                                <span
                                  className="inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2 py-0.5 font-mono text-[10px]"
                                  style={{ color: STATE_COLOR[st], background: `color-mix(in srgb, ${STATE_COLOR[st]} 14%, transparent)` }}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${st === "running" ? "yh-dotpulse" : ""}`}
                                    style={{ background: STATE_COLOR[st] }}
                                  />
                                  {STATE_LABEL[st]}
                                </span>
                              </div>
                              {/* 行2：描述 + 耗时/token + chevron（参考稿） */}
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <p className="text-[12px] text-ink-faint">{node.desc}</p>
                                <span className="flex shrink-0 items-center gap-2">
                                  {log?.latencyMs != null || (log && (log.tokensIn != null || log.tokensOut != null)) ? (
                                    <span className="font-mono text-[10px] text-ink-faint">
                                      {log?.latencyMs != null ? `${log.latencyMs}ms` : ""}
                                      {log && (log.tokensIn != null || log.tokensOut != null)
                                        ? `${log?.latencyMs != null ? " · " : ""}${(log.tokensIn ?? 0) + (log.tokensOut ?? 0)}tok`
                                        : ""}
                                    </span>
                                  ) : null}
                                  {log?.outputSummary ? (
                                    <svg
                                      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                                      className="shrink-0 text-ink-faint transition-transform"
                                      style={{ transform: open ? "rotate(90deg)" : "none" }}
                                      aria-hidden
                                    >
                                      <path d="M9 6l6 6-6 6" />
                                    </svg>
                                  ) : null}
                                </span>
                              </div>
                              {st === "running" ? (
                                <div className="yh-shimmer-track mt-1.5 h-0.5 w-full rounded bg-surface-2" />
                              ) : null}
                              {open && log?.outputSummary ? (
                                <div
                                  className="mt-2 rounded-md border border-hairline px-3 py-2 font-mono text-[11px] leading-relaxed"
                                  style={{
                                    background: "rgba(255,255,255,.018)",
                                    color: st === "failed" ? "var(--danger)" : "var(--text-muted)",
                                  }}
                                >
                                  {log.inputSummary ? (
                                    <div className="text-ink-faint">← {log.inputSummary}</div>
                                  ) : null}
                                  <div>→ {log.outputSummary}</div>
                                </div>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ol>

                    {/* done → preview + publish (real cross-origin sandbox preview) */}
                    {succeeded && done?.entryUrl && done.runtime && done.versionNumber ? (
                      <div className="mt-2 border-t border-hairline pt-4">
                        <PreviewPane
                          entryUrl={done.entryUrl}
                          runtime={done.runtime}
                          versionNumber={done.versionNumber}
                        />
                        <div className="mt-4 border-t border-hairline pt-3">
                          {published ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] font-medium" style={{ color: "var(--ok)" }}>
                                ✓ 已发布到首页
                              </span>
                              <div className="flex gap-2">
                                <Button href="/" variant="ghost" size="sm">
                                  去首页
                                </Button>
                                {done.gameId ? (
                                  <Button href={`/play/${done.gameId}`} variant="play" size="sm">
                                    ▶ 立即游玩
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12px] text-ink-muted">满意？发布后所有人可在首页玩到。</span>
                              <Button variant="create" size="sm" onClick={() => void publish()} disabled={publishing}>
                                {publishing ? "发布中…" : "发布到首页"}
                              </Button>
                            </div>
                          )}
                          {publishError ? <p className="mt-2 text-[12px] text-danger">{publishError}</p> : null}
                        </div>
                      </div>
                    ) : null}

                    {/* failed → retry */}
                    {failed ? (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-3">
                        {submitError ? (
                          <span className="min-w-0 flex-1 truncate text-[12px] text-danger">{submitError}</span>
                        ) : (
                          <span className="text-[12px] text-ink-muted">生成失败。</span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => void retry()}>
                          重试（从头重排）
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* composer */}
        <div
          className="border-t border-hairline px-4 py-4"
          style={{ background: "linear-gradient(0deg,rgba(255,255,255,.015),transparent)" }}
        >
          {uploads.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-2">
              {uploads.map((u) => (
                <li
                  key={u.assetId}
                  className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-2 py-1 text-[12px] text-ink-muted"
                >
                  {u.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.getUrl} alt="" className="h-6 w-6 rounded object-cover" />
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded bg-surface-2 text-[10px]">file</span>
                  )}
                  <span className="max-w-[120px] truncate">{u.name}</span>
                  {!busy ? (
                    <button onClick={() => removeUpload(u.assetId)} className="text-ink-faint hover:text-danger" aria-label="移除">
                      ✕
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-end gap-2.5 rounded-lg border border-hairline bg-surface-inset p-2 pl-2.5">
            <label
              title="附素材"
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md border border-hairline text-[18px] leading-none text-ink-muted transition-colors hover:border-hairline-brand hover:text-ink"
            >
              <input
                type="file"
                multiple
                accept="image/*,video/mp4,text/plain,application/json"
                className="hidden"
                disabled={busy || uploadBusy}
                onChange={(e) => void onFiles(e.target.files)}
              />
              {uploadBusy ? "…" : "＋"}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="描述你想做的游戏…（⌘/Ctrl + Enter 发送）"
              rows={1}
              className="max-h-32 min-h-[36px] flex-1 resize-none self-center bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <Button variant="create" size="md" onClick={() => void submit()} disabled={!prompt.trim() || busy} className="shrink-0">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(4,34,58,.3)]"
                    style={{ borderTopColor: "var(--grad-create-fg)" }}
                  />
                  {ctaText}
                </span>
              ) : (
                ctaText
              )}
            </Button>
          </div>
          {uploadError ? <p className="mt-2 text-[12px] text-danger">{uploadError}</p> : null}
          {submitError && !failed ? <p className="mt-2 text-[12px] text-danger">{submitError}</p> : null}
        </div>
      </div>
    </div>
  );
}
