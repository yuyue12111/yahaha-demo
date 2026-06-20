"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Brand } from "@/components/brand/Logo";

/**
 * 侧栏（参考稿 Home mock §sidebar）：Y-fork 品牌 + 醒目「创作」主胶囊（平台核心 = AI 创作）
 * + 图标导航（发现/排行/我的/设置，选中 = surface-2 + r-md）。账号区移到顶栏 avatar。
 * 「我的/设置」暂无后端 → 渲染为 disabled 占位（与参考稿里它们的次级灰态一致），不做死链。
 */
type NavItem = {
  label: string;
  icon: ReactNode;
  href?: string;
  match?: (p: string, q: URLSearchParams) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/",
    label: "发现",
    match: (p, q) => p === "/" && q.get("sort") !== "popular",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polygon points="15.5 8.5 13 13 8.5 15.5 11 11" />
      </svg>
    ),
  },
  {
    href: "/?sort=popular",
    label: "排行",
    match: (p, q) => p === "/" && q.get("sort") === "popular",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 20v-6M12 20V6M18 20v-9" />
      </svg>
    ),
  },
  {
    label: "我的",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
    ),
  },
  {
    label: "设置",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h8M17 8h2M5 16h2M11 16h8" />
        <circle cx="15" cy="8" r="2" />
        <circle cx="9" cy="16" r="2" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col gap-5 border-r border-hairline bg-surface px-4 py-6 md:flex">
      <Link href="/" className="px-1">
        <Brand size={30} />
      </Link>

      {/* 主操作 = 创作（平台核心：AI 把点子跑成可玩游戏）。create 渐变=创作旅程语义。 */}
      <Link
        href="/create"
        className="flex h-11 items-center justify-center gap-2 rounded-pill bg-grad-create text-[14px] font-bold text-[color:var(--grad-create-fg)] shadow-[0_8px_22px_-8px_rgba(39,224,255,.6),inset_0_1px_0_rgba(255,255,255,.4)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      >
        ✦ 创作
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((it) => {
          if (!it.href) {
            // 占位项（暂未开放）：保持参考稿次级灰态，不导航。
            return (
              <span
                key={it.label}
                title="敬请期待"
                aria-disabled
                className="flex cursor-default items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-ink-faint/70"
              >
                <span className="shrink-0 text-current">{it.icon}</span>
                {it.label}
              </span>
            );
          }
          const active = it.match?.(pathname, params) ?? false;
          return (
            <Link
              key={it.label}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <span className="shrink-0 text-current">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
