"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActiveVersionResponse } from "@/lib/contracts/games";
import { GameMessage, hostMessage } from "@/lib/contracts/play-messages";
import { StatePill } from "./StatePill";
import { SourceBadge } from "./SourceBadge";

export type PlayStatus = "loading" | "loaded" | "failed" | "ended";
export type ResolveErrorInfo = { status: number; error: string; detail: string | null };

const WATCHDOG_MS = 15_000;

export function PlayShell({
  gameId,
  active,
  resolveError,
  regenHref = null,
  detailHref = null,
}: {
  gameId: string;
  active: ActiveVersionResponse | null;
  resolveError: ResolveErrorInfo | null;
  /** 非空（作者本人）→ 显示「生成新版本」入口（B2）。 */
  regenHref?: string | null;
  /** 非空 → 显示「详情」入口（T3 详情页）。 */
  detailHref?: string | null;
}) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const onloadRef = useRef(false);
  const loadReportedRef = useRef(false); // LOAD 每次挂载只回写一次（playCount 不被本地重开灌水）
  const loadAtRef = useRef<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [status, setStatus] = useState<PlayStatus>(active ? "loading" : "failed");
  const [score, setScore] = useState(0);
  const [fail, setFail] = useState<{ url: string | null; reason: string }>(() =>
    active
      ? { url: null, reason: "" }
      : {
          url: null,
          reason: resolveErrorMessage(resolveError),
        },
  );

  // Load lifecycle: message listener + watchdog. Re-runs on retry (reloadKey) / entry change.
  useEffect(() => {
    if (!active) return;
    const entryUrl = active.entryUrl;

    loadedRef.current = false;
    onloadRef.current = false;
    loadReportedRef.current = false;
    loadAtRef.current = null;
    setStatus("loading");
    setScore(0);
    setFail({ url: null, reason: "" });

    // 埋点回写（docs/06/08）：同源 POST，fire-and-forget，失败不影响游玩。
    const report = (type: "LOAD" | "END" | "ERROR", extra?: Record<string, number>) => {
      void fetch("/api/play-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, type, ...extra }),
      }).catch(() => {});
    };

    const clearWatchdog = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };

    watchdogRef.current = setTimeout(() => {
      if (loadedRef.current) return;
      // MED-1: a 404/NoSuchKey frame ALSO fires onload, so onload is NOT proof of a working game.
      // Without a real GAME_LOADED handshake within the window → failed (never degrade to "loaded").
      setStatus("failed");
      setFail({
        url: entryUrl,
        reason: onloadRef.current
          ? "入口已加载但未收到 GAME_LOADED 握手（可能不是有效游戏或运行期出错）"
          : `加载超时：${WATCHDOG_MS / 1000}s 内未就绪`,
      });
    }, WATCHDOG_MS);

    const onMessage = (event: MessageEvent) => {
      // 1) identity: only the frame we mounted (sandboxed → opaque origin "null"; never trust origin)
      if (event.source !== iframeRef.current?.contentWindow) return;
      // 2) schema: validate the {source:"yahaha-game", v:1, type, ...} envelope before acting
      const parsed = GameMessage.safeParse(event.data);
      if (!parsed.success) return;
      const msg = parsed.data;

      switch (msg.type) {
        case "GAME_LOADED":
          loadedRef.current = true;
          clearWatchdog();
          setStatus("loaded");
          if (!loadReportedRef.current) {
            loadReportedRef.current = true; // 本地重开重复广播 GAME_LOADED → 只第一次计一次 play
            loadAtRef.current = Date.now();
            report("LOAD");
          }
          break;
        case "GAME_SCORE":
          setScore(msg.payload.score);
          break;
        case "GAME_ENDED":
          loadedRef.current = true;
          clearWatchdog();
          if (msg.payload?.score != null) setScore(msg.payload.score);
          setStatus("ended");
          report("END", {
            ...(msg.payload?.score != null ? { score: msg.payload.score } : {}),
            ...(loadAtRef.current ? { durationMs: Date.now() - loadAtRef.current } : {}),
          });
          break;
        case "GAME_ERROR":
          clearWatchdog();
          setStatus("failed");
          setFail({ url: entryUrl, reason: msg.payload.message });
          report("ERROR");
          break;
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearWatchdog();
    };
  }, [active, reloadKey, gameId]);

  const handleRetry = useCallback(() => {
    if (active) {
      setReloadKey((k) => k + 1); // remount iframe → re-fetch remote bundle, re-arm watchdog
    } else {
      router.refresh(); // resolve failed server-side → re-run the server component
    }
  }, [active, router]);

  const handleRestart = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(hostMessage("HOST_RESTART"), "*"); // targetOrigin "*": can't name a null origin
    setScore(0);
    setStatus("loaded");
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-4 py-6">
      {/* top bar */}
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center bg-grad-play text-white"
            style={{ borderRadius: "30%" }}
            aria-hidden
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.9 6.26L21.8 9l-5 4.6L18.2 21 12 17.3 5.8 21l1.4-7.4-5-4.6 6.9-.74L12 2z" />
            </svg>
          </span>
          <span className="text-[15px] font-extrabold tracking-tight">Yahaha</span>
        </Link>
        <div className="flex items-center gap-3">
          {detailHref ? (
            <Link
              href={detailHref}
              className="text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              详情
            </Link>
          ) : null}
          {regenHref ? (
            <Link
              href={regenHref}
              className="rounded-pill border border-hairline-strong px-2.5 py-0.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              ＋ 新版本
            </Link>
          ) : null}
          {status === "loaded" || status === "ended" ? (
            <span className="font-mono text-[12px] text-ink-muted">Score {score}</span>
          ) : null}
          <StatePill status={status} />
        </div>
      </header>

      {/* stage */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-hairline-brand bg-surface-inset">
        {active ? (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={active.entryUrl}
            // ★ allow-scripts ONLY — no allow-same-origin (cross-origin isolation, Fatal #2).
            sandbox="allow-scripts"
            title={`Game ${gameId}`}
            className="h-full w-full border-0"
            onLoad={() => {
              onloadRef.current = true;
            }}
          />
        ) : null}

        {status === "loading" ? <LoadingOverlay controls={active?.controls ?? ""} /> : null}
        {status === "failed" ? (
          <FailedOverlay url={fail.url} reason={fail.reason} onRetry={handleRetry} />
        ) : null}
        {status === "ended" ? (
          <EndedOverlay score={score} onRestart={handleRestart} />
        ) : null}
      </div>

      {/* 玩法提示（T1：从 manifest.controls 透传）+ proof: Source badge + isolation note */}
      {active ? (
        <div className="flex flex-col gap-1.5">
          {active.controls ? (
            <p className="flex items-start gap-1.5 text-[12px] text-ink-muted">
              <span className="shrink-0 text-ink-faint">玩法</span>
              <span>{active.controls}</span>
            </p>
          ) : null}
          <SourceBadge url={active.entryUrl} />
          <p className="font-mono text-[11px] text-ink-faint">
            sandbox=&quot;allow-scripts&quot; · cross-origin · runtime {active.runtime} · v
            {active.versionNumber}
          </p>
        </div>
      ) : null}
    </main>
  );
}

function resolveErrorMessage(e: ResolveErrorInfo | null): string {
  if (!e) return "无法解析该游戏的可用版本";
  if (e.error === "GAME_NOT_FOUND") return "未找到该游戏（GAME_NOT_FOUND）";
  if (e.error === "MANIFEST_UNAVAILABLE")
    return "远端清单不可用（MANIFEST_UNAVAILABLE）——MinIO 未就绪或对象缺失";
  if (e.error === "ENTRY_NOT_FOUND")
    return "入口产物缺失（ENTRY_NOT_FOUND）——manifest 在但 index.html 不在远端";
  return e.error;
}

function LoadingOverlay({ controls }: { controls: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-surface-inset/80 px-6 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-hairline-strong"
          style={{ borderTopColor: "var(--running)" }}
          aria-hidden
        />
        <p className="text-sm text-ink-muted">正在加载远端游戏文件…</p>
        {controls ? <p className="text-[12px] text-ink-faint">玩法：{controls}</p> : null}
      </div>
    </div>
  );
}

function FailedOverlay({
  url,
  reason,
  onRetry,
}: {
  url: string | null;
  reason: string;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-surface-inset/95 p-6">
      <div className="w-full max-w-sm rounded-lg border border-hairline-strong bg-surface p-5 text-center">
        <div
          className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--danger) 16%, transparent)", color: "var(--danger)" }}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 8v5M12 16.5v.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <p className="text-[15px] font-bold text-ink">加载失败</p>
        <p className="mt-1 text-sm text-ink-muted">{reason}</p>
        {url ? (
          <p className="mt-2 break-all rounded-md bg-surface-inset px-2 py-1 font-mono text-[11px] text-ink-faint">
            {url}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 items-center rounded-lg border border-hairline-strong px-4 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          重试
        </button>
      </div>
    </div>
  );
}

function EndedOverlay({ score, onRestart }: { score: number; onRestart: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-surface-inset/95 p-6">
      <div className="w-full max-w-sm rounded-lg border border-hairline-strong bg-surface p-6 text-center">
        <p className="text-sm text-ink-muted">游戏结束</p>
        <p className="my-2 text-[28px] font-extrabold leading-none text-ink">{score}</p>
        <p className="text-[12px] text-ink-faint">最终得分</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex h-10 items-center rounded-pill bg-grad-play px-5 text-sm font-bold text-white"
          >
            重新开始
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg border border-hairline-strong px-4 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
