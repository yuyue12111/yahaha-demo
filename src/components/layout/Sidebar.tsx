"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Brand } from "@/components/brand/Logo";

/**
 * 侧栏（参考稿 Home mock §sidebar）：Y-fork 品牌 + 洋红「▶ Play」主胶囊 +
 * 图标导航（选中 = surface-2 + r-md）+ 底部账号区。只列真实目的地（发现/创作/最热）。
 */
type NavItem = {
  href: string;
  label: string;
  match: (p: string, q: URLSearchParams) => boolean;
  icon: ReactNode;
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
    label: "最热",
    match: (p, q) => p === "/" && q.get("sort") === "popular",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 20v-6M12 20V6M18 20v-9" />
      </svg>
    ),
  },
  {
    href: "/create",
    label: "创作",
    match: (p) => p.startsWith("/create"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      </svg>
    ),
  },
];

export function Sidebar({ account }: { account?: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col gap-5 border-r border-hairline bg-surface px-4 py-6 md:flex">
      <Link href="/" className="px-1">
        <Brand size={30} />
      </Link>

      {/* 主操作（参考稿洋红 Play 胶囊）→ 发现/游玩 hub */}
      <Link
        href="/"
        className="flex h-11 items-center justify-center gap-2 rounded-pill bg-grad-play text-[14px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(192,59,255,.5),inset_0_1px_0_rgba(255,255,255,.22)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      >
        ▶ Play
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((it) => {
          const active = it.match(pathname, params);
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

      {/* 底部账号区（登录态名 + 登出 / 未登录 登录注册），server 注入 */}
      <div className="mt-auto border-t border-hairline pt-4">{account}</div>
    </aside>
  );
}
