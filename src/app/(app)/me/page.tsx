import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listGamesByAuthor, listFavoriteGames } from "@/lib/games";
import { GameCard } from "@/components/game/GameCard";
import type { GameCard as GameCardData } from "@/lib/contracts/games";
import { Button } from "@/components/ui/Button";
import { YForkLogo } from "@/components/brand/Logo";
import { ProfileActions } from "@/components/profile/ProfileActions";

// 受保护（middleware + 服务端 auth 双守卫）：当前用户的个人主页（参考稿 Astrocade）。
export const dynamic = "force-dynamic";

function handleFrom(name: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 20);
  return "@" + (slug || "user");
}

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/me");

  const sp = await searchParams;
  const tab = sp.tab === "created" ? "created" : "favorites";

  const name = session.user.name ?? session.user.email ?? "我";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const handle = handleFrom(name);

  const [{ published, draftCount, totalPlays }, favorites] = await Promise.all([
    listGamesByAuthor(session.user.id),
    listFavoriteGames(session.user.id),
  ]);

  // Plays 真实；Followers/Following 暂无社交系统 → 0（待社交功能）。
  const stats: { label: string; value: string }[] = [
    { label: "Plays", value: totalPlays > 0 ? String(totalPlays) : "—" },
    { label: "Followers", value: "0" },
    { label: "Following", value: "0" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* 资料头：背景板 + 头像 + handle + 统计 */}
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
        {/* 背景板（默认品牌渐变；用户自定义为后续） */}
        <div
          className="relative h-36 sm:h-44"
          style={{
            background:
              "radial-gradient(80% 140% at 15% 0%, rgba(192,59,255,.45), transparent 60%), radial-gradient(70% 130% at 85% 10%, rgba(39,224,255,.35), transparent 60%), linear-gradient(120deg,#1a1330,#100c18)",
          }}
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 40%,rgba(22,18,31,.85))" }} />
        </div>

        {/* 头部行 */}
        <div className="px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end gap-4">
            {/* 头像（覆盖背景板） */}
            <span className="-mt-12 shrink-0 sm:-mt-14">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={name}
                  className="h-24 w-24 rounded-full border-4 border-surface object-cover shadow-modal"
                />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-full border-4 border-surface bg-grad-create text-[34px] font-extrabold text-[color:var(--grad-create-fg)] shadow-modal">
                  {initial}
                </span>
              )}
            </span>

            {/* handle + 操作 */}
            <div className="flex min-w-0 items-center gap-3 pb-1">
              <h1 className="truncate text-[26px] font-extrabold tracking-tight text-ink sm:text-[28px]">{handle}</h1>
              <ProfileActions />
            </div>

            {/* 统计（Plays 真实；Followers/Following 待社交系统） */}
            <div className="ml-auto flex gap-2.5 pb-1">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="min-w-[86px] rounded-lg border border-hairline bg-surface-inset px-4 py-2.5 text-center"
                >
                  <div className="text-[12px] text-ink-muted">{s.label}</div>
                  <div className="mt-0.5 text-[18px] font-extrabold text-ink">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="mb-6 mt-6 flex gap-2">
        <TabLink href="/me" active={tab === "favorites"}>
          Favorites
        </TabLink>
        <TabLink href="/me?tab=created" active={tab === "created"}>
          Created
        </TabLink>
      </div>

      {/* content */}
      {tab === "favorites" ? (
        favorites.length === 0 ? (
          <EmptyState
            title="No favorited games"
            desc="Games you love will appear here. Tap the bookmark icon on the ones you like!"
          />
        ) : (
          <Grid games={favorites} />
        )
      ) : published.length === 0 ? (
        <EmptyState
          title="还没有作品"
          desc={draftCount > 0 ? `有 ${draftCount} 个草稿还没发布。` : "用 AI 把点子跑成可玩游戏。"}
        />
      ) : (
        <Grid games={published} />
      )}
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-pill px-5 py-2 text-[15px] font-bold transition-colors ${
        active ? "bg-ink text-bg" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Grid({ games }: { games: GameCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <YForkLogo size={64} float />
      <h3 className="mt-6 text-[22px] font-extrabold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-muted">{desc}</p>
      <Button href="/" variant="primary" size="lg" className="mt-7">
        Discover Games
      </Button>
    </div>
  );
}
