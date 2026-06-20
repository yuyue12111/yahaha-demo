"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand/Logo";

/**
 * 侧栏（docs/10 §Sidebar nav）：Y-fork 品牌 + 招牌 Create CTA + nav（选中 = surface-2 + r-md）。
 * 只列真实目的地（发现/创作），不放未实现的占位项（不过度宣称）。
 */
const NAV = [
  {
    href: "/",
    label: "发现",
    match: (p: string) => p === "/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polygon points="15.5 8.5 13 13 8.5 15.5 11 11" />
      </svg>
    ),
  },
  {
    href: "/create",
    label: "创作",
    match: (p: string) => p.startsWith("/create"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-[224px] shrink-0 flex-col gap-6 border-r border-hairline bg-surface px-4 py-6 md:flex">
      <Link href="/" className="px-1">
        <Brand size={30} />
      </Link>

      <Link
        href="/create"
        className="flex h-11 items-center justify-center gap-2 rounded-pill bg-grad-create text-[14px] font-bold text-[color:var(--grad-create-fg)] shadow-[0_8px_22px_-8px_rgba(39,224,255,.6),inset_0_1px_0_rgba(255,255,255,.4)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      >
        ✦ 用 AI 创作
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map((it) => {
          const active = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <span className="shrink-0 text-current">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-1 font-mono text-[10px] leading-relaxed text-ink-faint">
        Yahaha · AI Native
        <br />
        互动游戏平台
      </div>
    </aside>
  );
}
