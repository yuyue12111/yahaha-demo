import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { Brand } from "@/components/brand/Logo";

/**
 * App 外壳（参考稿）：桌面 = 左侧栏（品牌 + Play + 导航 + 底部账号）+ 主区；
 * 移动 = 顶部精简栏（品牌 + 账号）。login/register/play 不进此壳，各自有顶栏。
 * 每个页面自带顶部处理（Home 搜索行 / Create 自有 top bar），故不再设全局顶栏。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={<div className="hidden w-[224px] shrink-0 border-r border-hairline bg-surface md:block" />}>
        <Sidebar account={<UserMenu />} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 移动端顶栏（桌面用侧栏代替） */}
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
