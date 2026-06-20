import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

/** 顶栏右侧账号区（server component）：登录态显示名 + 登出（server action）；未登录 登录/注册。 */
export async function UserMenu() {
  const session = await auth();

  if (session?.user) {
    const label = session.user.name ?? session.user.email ?? "";
    const initial = label.trim().charAt(0).toUpperCase() || "?";
    return (
      <div className="flex items-center gap-2.5">
        {/* 账号头像（参考稿 Home 顶栏 avatar）：首字母 + 创作渐变圆 */}
        <span
          title={label}
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grad-create text-[13px] font-bold text-[color:var(--grad-create-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"
        >
          {initial}
        </span>
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
