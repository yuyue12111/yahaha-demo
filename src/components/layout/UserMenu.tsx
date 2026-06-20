import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { RemoteImg } from "@/components/ui/RemoteImg";

/** 顶栏右侧账号区（server component）：头像（→「我的」）+ 登出（server action）；未登录 登录/注册。 */
export async function UserMenu() {
  const session = await auth();

  if (session?.user) {
    const label = session.user.name ?? session.user.email ?? "";
    const initial = label.trim().charAt(0).toUpperCase() || "?";
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { avatarUrl: true } });
    return (
      <div className="flex items-center gap-2.5">
        {/* 账号头像（参考稿 Home 顶栏 avatar）：点击 → 我的主页；有上传头像则显示图，否则首字母渐变圆 */}
        <Link
          href="/me"
          title="我的主页"
          aria-label="我的主页"
          className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-grad-create text-[13px] font-bold text-[color:var(--grad-create-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,.3)] transition-transform hover:scale-105"
        >
          {me?.avatarUrl ? (
            <RemoteImg src={me.avatarUrl} alt={label} className="h-full w-full object-cover" fallback={<>{initial}</>} />
          ) : (
            initial
          )}
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button variant="ghost" size="sm" type="submit">
            登出
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" href="/login">
        登录
      </Button>
      <Button variant="primary" size="sm" href="/register">
        注册
      </Button>
    </div>
  );
}
