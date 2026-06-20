"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActiveVersionResponse } from "@/lib/contracts/games";
import { GameMessage, hostMessage } from "@/lib/contracts/play-messages";
import { StatePill } from "./StatePill";
import { SourceBadge } from "./SourceBadge";
import { YForkLogo } from "@/components/brand/Logo";

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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const onloadRef = useRef(false);
  const loadReportedRef = useRef(false); // LOAD 每次挂载只回写一次（playCount 不被本地重开灌水）
  const loadAtRef = useRef<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [status, setStatus] = useState<PlayStatus>(active ? "loading" : "failed");
  const [score, setScore] = useState(0);
  const [showStart, setShowStart] = useState(false); // P1：加载后「点击开始」提示，点击聚焦 iframe
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
    setShowStart(false);
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
          iframeRef.current?.focus(); // P1：聚焦 iframe，键盘立即可控（不必先点画面）
          if (!loadReportedRef.current) {
            loadReportedRef.current = true; // 本地重开重复广播 GAME_LOADED → 只第一次计一次 play
            loadAtRef.current = Date.now();
            setShowStart(true); // 首屏「点击开始」提示
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
    iframeRef.current?.focus(); // P1：重开后保持键盘可控
  }, []);

  // P2：全屏化舞台（宿主对自己的容器调用，非沙箱 iframe 请求 → 不需 allow-fullscreen，不动红线②）。
  const handleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen?.().catch(() => {});
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 px-4 py-6">
      {/* top bar */}
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <YForkLogo size={28} />
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
      <div
        ref={stageRef}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-hairline-brand bg-surface-inset"
      >
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
        {status === "loaded" && showStart ? (
          <StartOverlay
            controls={active?.controls ?? ""}
            onStart={() => {
              iframeRef.current?.focus();
              setShowStart(false);
            }}
          />
        ) : null}
        {status === "failed" ? (
          <FailedOverlay url={fail.url} reason={fail.reason} onRetry={handleRetry} />
        ) : null}
        {status === "ended" ? (
          <EndedOverlay score={score} onRestart={handleRestart} />
        ) : null}
      </div>

      {/* control bar — 真实控件（重开 / 全屏）；不放未实现的暂停/音量/收藏/分享/在线 */}
      {active ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRestart}
            disabled={status !== "loaded" && status !== "ended"}
            title="重开"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline-strong px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 1 0 2.6-6.4" />
              <path d="M3 4v4h4" />
            </svg>
            重开
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            title="全屏"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline-strong px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            全屏
          </button>
        </div>
      ) : null}

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
    <div
      className="absolute inset-0 grid place-items-center overflow-hidden px-6"
      style={{ background: "radial-gradient(circle at 50% 42%, rgba(192,59,255,.22), transparent 60%), rgba(16,12,24,.86)" }}
    >
      {/* 招牌 aura（参考设计）：缓慢旋转的彩色光晕 */}
      <span
        className="yh-aura pointer-events-none absolute h-72 w-72 rounded-full blur-2xl"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,59,167,.22), rgba(192,59,255,.05), rgba(39,224,255,.18), rgba(255,59,167,.22))",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <span
          className="h-11 w-11 animate-spin rounded-full border-[3px] border-hairline-strong"
          style={{ borderTopColor: "var(--running)", boxShadow: "0 0 26px rgba(39,224,255,.4)" }}
          aria-hidden
        />
        <p className="text-[13px] font-medium" style={{ color: "var(--running)" }}>
          载入中 · 拉取远端 bundle…
        </p>
        {controls ? <p className="text-[12px] text-ink-faint">玩法：{controls}</p> : null}
      </div>
    </div>
  );
}

function StartOverlay({ controls, onStart }: { controls: string; onStart: () => void }) {
  // 满舞台按钮：点击任意处聚焦 iframe 并开始（修「进游戏按键无反应」）。
  return (
    <button
      type="button"
      onClick={onStart}
      aria-label="点击开始游戏"
      className="absolute inset-0 grid place-items-center bg-surface-inset/55 backdrop-blur-[1px] transition-opacity"
    >
      <span className="flex flex-col items-center gap-2 px-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-grad-play text-[18px] text-white shadow-lg">
          ▶
        </span>
        <span className="text-sm font-semibold text-ink">点击开始</span>
        {controls ? <span className="text-[12px] text-ink-muted">{controls}</span> : null}
      </span>
    </button>
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
