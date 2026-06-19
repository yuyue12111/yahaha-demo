import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// 受保护：middleware 已挡未登录；这里再做服务端 auth() 守卫（双保险，docs/03）。
export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/create");

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-hairline bg-surface p-8 text-center">
      <h1 className="text-[22px] font-bold text-ink">Create</h1>
      <p className="mt-2 text-sm text-ink-muted">
        你好，{session.user.name ?? session.user.email}。异步多 Agent 生成（Create 流水线）将在下一个 checkpoint 上线。
      </p>
      <p className="mt-1 font-mono text-[12px] text-ink-faint">受保护路由 · 已登录可见</p>
    </div>
  );
}
