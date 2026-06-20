"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
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

type NodeState = "pending" | "running" | "done" | "failed";
type UploadItem = { assetId: string; name: string; type: string; getUrl: string };

const STATE_COLOR: Record<NodeState, string> = {
  pending: "var(--canceled)",
  running: "var(--running)",
  done: "var(--ok)",
  failed: "var(--danger)",
};

export function CreateStudio({
  regen = null,
}: {
  /** 非空 → 在已有游戏上生成新版本（提交带 gameId → packager 产 versionNumber+1）。 */
  regen?: { gameId: string; title: string } | null;
} = {}) {
  const [prompt, setPrompt] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [runningAgent, setRunningAgent] = useState<AgentName | null>(null);
  const [logsByAgent, setLogsByAgent] = useState<Partial<Record<AgentName, AgentLogDTO>>>({});
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
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
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

  // B3：跨 6 节点聚合生成成本（mock 估算；确定性节点贡献 0）。
  const logVals = Object.values(logsByAgent);
  const hasTokens = logVals.some((l) => l?.tokensIn != null || l?.tokensOut != null);
  const tokenTotal = logVals.reduce(
    (acc, l) => ({ in: acc.in + (l?.tokensIn ?? 0), out: acc.out + (l?.tokensOut ?? 0) }),
    { in: 0, out: 0 },
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* 左：创意输入 */}
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Create</h1>
          <p className="mt-1 text-sm text-ink-muted">
            描述你的游戏创意，可选附上参考图。提交后由独立 worker 异步跑 6 节点生成流水线。
          </p>
        </div>

        {regen ? (
          <div className="rounded-lg border border-hairline-brand bg-surface-inset px-3 py-2 text-[13px] text-ink-muted">
            在《<span className="font-medium text-ink">{regen.title}</span>》上生成新版本
            —— 产物记为 <span className="font-mono">v+1</span>，生成后可发布切换为该游戏的 active 版本。
          </div>
        ) : null}

        <div className="rounded-lg border border-hairline bg-surface-inset p-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：一个太空主题的躲避小游戏，霓虹风格，越玩越快…"
            rows={5}
            disabled={busy}
            className="w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-hairline pt-2">
            <label className="cursor-pointer text-[13px] text-ink-muted hover:text-ink">
              <input
                type="file"
                multiple
                accept="image/*,video/mp4,text/plain,application/json"
                className="hidden"
                disabled={busy || uploadBusy}
                onChange={(e) => void onFiles(e.target.files)}
              />
              {uploadBusy ? "上传中…" : "＋ 附素材"}
            </label>
            <Button
              variant="create"
              size="md"
              onClick={() => void submit()}
              disabled={!prompt.trim() || busy}
            >
              {busy ? "生成中…" : "生成游戏"}
            </Button>
          </div>
        </div>

        {uploadError ? <p className="text-[12px] text-danger">{uploadError}</p> : null}
        {uploads.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {uploads.map((u) => (
              <li
                key={u.assetId}
                className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-2 py-1 text-[12px] text-ink-muted"
              >
                {u.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.getUrl} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded bg-surface-2 text-[10px]">
                    file
                  </span>
                )}
                <span className="max-w-[120px] truncate">{u.name}</span>
                {!busy ? (
                  <button
                    onClick={() => removeUpload(u.assetId)}
                    className="text-ink-faint hover:text-danger"
                    aria-label="移除"
                  >
                    ✕
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {submitError ? <p className="text-[12px] text-danger">{submitError}</p> : null}
        {failed ? (
          <Button variant="ghost" size="md" onClick={() => void retry()}>
            重试（从头重排）
          </Button>
        ) : null}
      </section>

      {/* 右：run-timeline + 预览 */}
      <section className="flex flex-col gap-4">
        <div className="rounded-lg border border-hairline bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink">生成流水线</span>
            {taskStatus ? (
              <span className="font-mono text-[11px] text-ink-faint">
                {taskId?.slice(0, 8)} · {taskStatus}
              </span>
            ) : (
              <span className="text-[12px] text-ink-faint">尚未开始</span>
            )}
          </div>
          {hasTokens ? (
            <div className="mb-2 flex items-center justify-between rounded-md border border-hairline bg-surface-inset px-2.5 py-1.5 font-mono text-[11px] text-ink-muted">
              <span>Σ 生成成本（mock 估算）</span>
              <span>
                {tokenTotal.in} in · {tokenTotal.out} out · {tokenTotal.in + tokenTotal.out} tok
              </span>
            </div>
          ) : null}
          <ol className="flex flex-col gap-2">
            {NODES.map((node, i) => {
              const st = nodeState(node.name);
              const log = logsByAgent[node.name];
              return (
                <li
                  key={node.name}
                  className="flex gap-3 rounded-md border border-hairline bg-surface-inset p-2.5"
                >
                  <span
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                    style={{
                      color: STATE_COLOR[st],
                      background: `color-mix(in srgb, ${STATE_COLOR[st]} 16%, transparent)`,
                    }}
                  >
                    {st === "running" ? "•" : st === "done" ? "✓" : st === "failed" ? "✕" : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-ink">{node.label}</span>
                      <span className="font-mono text-[10px]" style={{ color: STATE_COLOR[st] }}>
                        {st}
                        {log?.latencyMs != null ? ` · ${log.latencyMs}ms` : ""}
                        {log && (log.tokensIn != null || log.tokensOut != null)
                          ? ` · ${(log.tokensIn ?? 0) + (log.tokensOut ?? 0)}tok`
                          : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-faint">{node.desc}</p>
                    {log?.outputSummary ? (
                      <p
                        className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px]"
                        style={{ color: st === "failed" ? "var(--danger)" : "var(--text-muted)" }}
                      >
                        {log.inputSummary ? `← ${log.inputSummary}\n` : ""}→ {log.outputSummary}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {succeeded && done?.entryUrl && done.runtime && done.versionNumber ? (
          <div className="rounded-lg border border-hairline bg-surface p-4">
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
                        立即游玩
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-ink-muted">满意？发布后所有人可在首页玩到。</span>
                  <Button
                    variant="create"
                    size="sm"
                    onClick={() => void publish()}
                    disabled={publishing}
                  >
                    {publishing ? "发布中…" : "发布到首页"}
                  </Button>
                </div>
              )}
              {publishError ? (
                <p className="mt-2 text-[12px] text-danger">{publishError}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
