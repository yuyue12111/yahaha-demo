"use client";

import { useState } from "react";

/** 资料页头部操作：编辑（占位，资料/头像/背景编辑为后续）+ 分享（复制本页链接，真实）。 */
export function ProfileActions() {
  const [copied, setCopied] = useState(false);

  const share = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title="编辑资料（敬请期待）"
        aria-label="编辑资料"
        className="grid h-9 w-9 cursor-default place-items-center rounded-full border border-hairline-strong text-ink-muted"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={share}
        title="分享 / 复制链接"
        aria-label="分享"
        className="grid h-9 w-9 place-items-center rounded-full border border-hairline-strong text-ink-muted transition-colors hover:text-ink"
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="M12 3v13M8 7l4-4 4 4" />
          </svg>
        )}
      </button>
    </div>
  );
}
