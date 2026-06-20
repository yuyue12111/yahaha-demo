"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { YForkLogo, PixelWordmark } from "@/components/brand/Logo";

/**
 * 侧栏（参考稿 Astrocade）：醒目 Y-fork 品牌 + 大「创作」主胶囊 + 大号图标导航，
 * 选中 = surface-2 圆角底。可点击收起/展开（localStorage 记忆），宽度+标签平滑过渡。
 * 导航只列真实可点目的地（发现/排行/我的）。「我的」= /me 作品页（真实，受保护）。
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
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 20v-6M12 20V6M18 20v-9" />
      </svg>
    ),
  },
  {
    href: "/me",
    label: "我的",
    match: (p) => p === "/me" || p.startsWith("/me/"),
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
    ),
  },
];

const COOKIE = "yahaha-sidebar-collapsed";

export function Sidebar({ initialCollapsed = false }: { initialCollapsed?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  // 初值：SSR 用服务端读到的 cookie（initialCollapsed）→ 客户端首渲染读最新 cookie，二者同源 → 无水合不一致。
  // 客户端重挂载（导航后）也读最新 cookie → 状态不丢。
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof document === "undefined") return initialCollapsed;
    try {
      return document.cookie.split("; ").some((c) => c === `${COOKIE}=1`);
    } catch {
      return initialCollapsed;
    }
  });
  // ready 仅用于「首渲染不带过渡，之后切换才动画」。
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        document.cookie = `${COOKIE}=${next ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    <aside
      className="sticky top-0 hidden h-screen shrink-0 flex-col gap-5 overflow-hidden border-r border-hairline bg-surface px-3.5 py-6 md:flex"
      style={{
        width: collapsed ? 78 : 244,
        transition: ready ? "width .32s cubic-bezier(.4,0,.2,1)" : undefined,
      }}
    >
      {/* 品牌 */}
      <Link href="/" className="flex h-11 items-center gap-2.5 px-1" title="Yahaha">
        <YForkLogo size={40} />
        <span className="transition-opacity duration-200" style={{ opacity: collapsed ? 0 : 1 }}>
          <PixelWordmark height={19} />
        </span>
      </Link>

      {/* 主操作 = 创作（平台核心）。create 渐变=创作旅程语义。 */}
      <Link
        href="/create"
        title="创作"
        className="flex h-14 items-center justify-center gap-2 rounded-pill bg-grad-create font-bold text-[color:var(--grad-create-fg)] shadow-[0_8px_22px_-8px_rgba(39,224,255,.6),inset_0_1px_0_rgba(255,255,255,.4)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <span className="text-[20px] leading-none">✦</span>
        <span
          className="whitespace-nowrap text-[17px] transition-opacity duration-200"
          style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}
        >
          创作
        </span>
      </Link>

      <div className="mx-1 h-px bg-hairline" />

      {/* 导航填满约整栏 2/3：nav 取 2 份、下方留 1 份弹性空白；每项 flex-1 撑成大块填空 */}
      <nav className="flex flex-[2] flex-col gap-3">
        {NAV.map((it) => {
          const active = it.match(pathname, params);
          return (
            <Link
              key={it.label}
              href={it.href}
              title={it.label}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 items-center gap-4 rounded-xl px-4 text-[18px] font-bold transition-colors ${
                active ? "bg-surface-2 text-ink" : "text-ink-muted hover:bg-surface-2/60 hover:text-ink"
              }`}
              style={{ minHeight: 60 }}
            >
              <span className="grid w-[26px] shrink-0 place-items-center text-current">{it.icon}</span>
              <span
                className="whitespace-nowrap transition-opacity duration-200"
                style={{ opacity: collapsed ? 0 : 1 }}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* 弹性留白：nav 占 2 份、这里 1 份 → nav 约整栏 2/3，收起留在底部 */}
      <div aria-hidden className="flex-1" />

      {/* 收起 / 展开 */}
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "展开侧栏" : "收起侧栏"}
        aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
        className="flex h-10 items-center gap-3.5 rounded-lg px-3.5 text-ink-faint transition-colors hover:bg-surface-2/60 hover:text-ink"
      >
        <span className="grid w-[22px] shrink-0 place-items-center">
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform duration-300"
            style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
            aria-hidden
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </span>
        <span
          className="whitespace-nowrap text-[14px] font-medium transition-opacity duration-200"
          style={{ opacity: collapsed ? 0 : 1 }}
        >
          收起
        </span>
      </button>
    </aside>
  );
}
