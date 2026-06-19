"use client";

import { useEffect, useRef, useState } from "react";
import { GameMessage } from "@/lib/contracts/play-messages";
import { StatePill } from "@/components/play/StatePill";
import { SourceBadge } from "@/components/play/SourceBadge";
import type { PlayStatus } from "@/components/play/PlayShell";

const WATCHDOG_MS = 15_000;

/**
 * Create 预览 —— 复用与 Play 完全相同的隔离形态：跨域 sandbox iframe（allow-scripts，**不带**
 * allow-same-origin）+ postMessage 契约 + Source 徽章。不改 PlayShell（保 Play 隔离不回退），
 * 但用同样的协议/组件，证明刚生成的 PREVIEW 产物就是从 MinIO 远端加载、可玩。
 */
export function PreviewPane({
  entryUrl,
  runtime,
  versionNumber,
}: {
  entryUrl: string;
  runtime: string;
  versionNumber: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const loadedRef = useRef(false);
  const [status, setStatus] = useState<PlayStatus>("loading");
  const [score, setScore] = useState(0);

  useEffect(() => {
    loadedRef.current = false;
    setStatus("loading");
    setScore(0);
    const wd = setTimeout(() => {
      if (!loadedRef.current) setStatus("failed");
    }, WATCHDOG_MS);

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return; // 身份校验（opaque origin，永不信 origin）
      const parsed = GameMessage.safeParse(ev.data);
      if (!parsed.success) return;
      const msg = parsed.data;
      switch (msg.type) {
        case "GAME_LOADED":
          loadedRef.current = true;
          clearTimeout(wd);
          setStatus("loaded");
          break;
        case "GAME_SCORE":
          setScore(msg.payload.score);
          break;
        case "GAME_ENDED":
          loadedRef.current = true;
          clearTimeout(wd);
          if (msg.payload?.score != null) setScore(msg.payload.score);
          setStatus("ended");
          break;
        case "GAME_ERROR":
          clearTimeout(wd);
          setStatus("failed");
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(wd);
    };
  }, [entryUrl]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-muted">预览 · 未发布（PREVIEW）</span>
        <div className="flex items-center gap-2">
          {status === "loaded" || status === "ended" ? (
            <span className="font-mono text-[12px] text-ink-muted">Score {score}</span>
          ) : null}
          <StatePill status={status} />
        </div>
      </div>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-xl border border-hairline-brand bg-surface-inset">
        <iframe
          ref={iframeRef}
          src={entryUrl}
          // ★ allow-scripts ONLY — cross-origin isolation (Fatal #2), same as Play.
          sandbox="allow-scripts"
          title={`Preview v${versionNumber}`}
          className="h-full w-full border-0"
        />
        {status === "loading" ? (
          <div className="absolute inset-0 grid place-items-center bg-surface-inset/80 text-sm text-ink-muted">
            正在加载远端产物…
          </div>
        ) : null}
        {status === "failed" ? (
          <div className="absolute inset-0 grid place-items-center bg-surface-inset/95 p-4 text-center text-sm text-ink-muted">
            预览加载失败（未收到 GAME_LOADED 握手）
          </div>
        ) : null}
      </div>
      <SourceBadge url={entryUrl} />
      <p className="font-mono text-[11px] text-ink-faint">
        sandbox=&quot;allow-scripts&quot; · cross-origin · runtime {runtime} · v{versionNumber}
      </p>
    </div>
  );
}
