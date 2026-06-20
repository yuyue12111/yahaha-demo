import { Sidebar } from "@/components/layout/Sidebar";
import { UserMenu } from "@/components/layout/UserMenu";

/** App 外壳：侧栏 + 顶栏（账号区）。包 Home/Create；login/register/play 不进此壳。 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-end gap-3 border-b border-hairline px-6 backdrop-blur"
          style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)" }}
        >
          <UserMenu />
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
