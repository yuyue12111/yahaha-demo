import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { Brand } from "@/components/brand/Logo";

/**
 * App 外壳（参考稿 Home）：左侧栏（品牌 + 创作主胶囊 + 导航）+ 顶栏（全局搜索 + 通知 + 账号 avatar）。
 * login/register/play 不进此壳。移动端用精简顶栏。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<div className="hidden w-[224px] shrink-0 border-r border-hairline bg-surface md:block" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 桌面顶栏：全局搜索（GET → Home 发现）+ 通知 + 账号 */}
        <header
          className="sticky top-0 z-20 hidden h-16 shrink-0 items-center gap-3 border-b border-hairline px-8 backdrop-blur md:flex"
          style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)" }}
        >
          <form method="get" action="/" className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              type="search"
              name="search"
              placeholder="搜索游戏、作者、标签…"
              aria-label="搜索游戏"
              className="h-11 w-full rounded-md border border-hairline bg-surface pl-11 pr-14 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,.025)] outline-none placeholder:text-ink-faint focus:border-hairline-strong"
            />
            <kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
              ⌘K
            </kbd>
          </form>
          <button
            type="button"
            title="通知（敬请期待）"
            aria-label="通知"
            className="grid h-11 w-11 shrink-0 cursor-default place-items-center rounded-lg border border-hairline text-ink-muted"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.5 21a1.5 1.5 0 0 1-3 0" />
            </svg>
          </button>
          <UserMenu />
        </header>
        {/* 移动端精简顶栏 */}
        <header
          className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline px-4 backdrop-blur md:hidden"
          style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)" }}
        >
          <Brand size={26} />
          <UserMenu />
        </header>
        <main className="flex-1 px-5 py-7 md:px-8">{children}</main>
      </div>
    </div>
  );
}
