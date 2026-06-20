"use client";

import { useState } from "react";

/** 资料页头部操作：分享（复制本页链接，真实）。头像/背景编辑见 ProfileImageUpload（直传）。 */
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
