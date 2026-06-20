import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listGamesByAuthor } from "@/lib/games";
import { GameCard } from "@/components/game/GameCard";
import { Button } from "@/components/ui/Button";

// 受保护（middleware + 服务端 auth 双守卫）：当前用户的作品页。
export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/me");

  const name = session.user.name ?? session.user.email ?? "我";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const { published, draftCount, totalPlays } = await listGamesByAuthor(session.user.id);

  const stats: { label: string; value: string | number }[] = [
    { label: "已发布", value: published.length },
    { label: "草稿", value: draftCount },
    { label: "累计游玩", value: totalPlays },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* 资料头 */}
      <div className="mb-7 flex flex-wrap items-center gap-5">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-grad-create text-[24px] font-extrabold text-[color:var(--grad-create-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"
          aria-hidden
        >
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-extrabold tracking-tight text-ink">{name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-4">
            {stats.map((s) => (
              <span key={s.label} className="text-[13px] text-ink-muted">
                <b className="font-bold text-ink">{s.value}</b> {s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="ml-auto">
          <Button href="/create" variant="create" size="md">
            ✦ 新建作品
          </Button>
        </div>
      </div>

      <h2 className="mb-4 text-[18px] font-extrabold text-ink">我的作品</h2>

      {published.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-ink-muted">
            {draftCount > 0 ? (
              <>有 {draftCount} 个草稿还没发布。</>
            ) : (
              <>还没有作品。</>
            )}{" "}
            <Link href="/create" className="text-brand-cyan underline-offset-2 hover:underline">
              用 AI 创作 →
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {published.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
