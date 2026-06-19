import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

/** 顶栏右侧账号区（server component）：登录态显示名 + 登出（server action）；未登录 登录/注册。 */
export async function UserMenu() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <span className="max-w-[160px] truncate text-sm text-ink-muted">
          {session.user.name ?? session.user.email}
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
