import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listGamesByAuthor, listFavoriteGames, getFavoriteIds } from "@/lib/games";
import { listRecentTasks, estimateCostUsd, type TaskHistoryItem } from "@/lib/task-history";
import { GameCard } from "@/components/game/GameCard";
import type { GameCard as GameCardData } from "@/lib/contracts/games";
import { Button } from "@/components/ui/Button";
import { RemoteImg } from "@/components/ui/RemoteImg";
import { YForkLogo } from "@/components/brand/Logo";
import { TaskRetryButton } from "@/components/create/TaskRetryButton";

// 默认背景板渐变（也作上传背景失效时的兜底）。
const BANNER_BG =
  "radial-gradient(80% 140% at 15% 0%, rgba(192,59,255,.45), transparent 60%), radial-gradient(70% 130% at 85% 10%, rgba(39,224,255,.35), transparent 60%), linear-gradient(120deg,#1a1330,#100c18)";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { ProfileImageUpload } from "@/components/profile/ProfileImageUpload";

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
  const userId = session.user.id;

  const sp = await searchParams;
  const tab =
    sp.tab === "created" ? "created" : sp.tab === "tasks" ? "tasks" : "favorites";

  const [user, { published, draftCount, totalPlays }, favorites, favoriteIds, tasks] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, avatarUrl: true, bannerUrl: true } }),
    listGamesByAuthor(userId),
    listFavoriteGames(userId),
    getFavoriteIds(userId),
    tab === "tasks" ? listRecentTasks(userId) : Promise.resolve([] as TaskHistoryItem[]),
  ]);

  const name = user?.displayName ?? session.user.name ?? session.user.email ?? "我";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const handle = handleFrom(name);
  const favSet = new Set(favoriteIds);

  // Plays 真实；Followers/Following 暂无社交系统 → 0（待社交功能）。三者统一显示数字，避免 —/0 混排。
  const stats: { label: string; value: string }[] = [
    { label: "Plays", value: String(totalPlays) },
    { label: "Followers", value: "0" },
    { label: "Following", value: "0" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* 资料头：背景板 + 头像 + handle + 统计 */}
      <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
        {/* 背景板（用户可换） */}
        <div className="relative h-36 sm:h-44">
          {user?.bannerUrl ? (
            <RemoteImg
              src={user.bannerUrl}
              alt=""
              className="h-full w-full object-cover"
              fallback={<div className="h-full w-full" style={{ background: BANNER_BG }} />}
            />
          ) : (
            <div className="h-full w-full" style={{ background: BANNER_BG }} />
          )}
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 45%,rgba(22,18,31,.9))" }} />
          <ProfileImageUpload
            kind="banner"
            className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-black/45 px-2.5 text-[12px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/65 disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 9a2 2 0 0 1 2-2h2l1.5-2h7L19 7h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
            更换背景
          </ProfileImageUpload>
        </div>

        {/* 头部行 */}
        <div className="px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end gap-4">
            {/* 头像（覆盖背景板）+ 上传相机 */}
            <div className="relative -mt-12 shrink-0 sm:-mt-14">
              {user?.avatarUrl ? (
                <RemoteImg
                  src={user.avatarUrl}
                  alt={name}
                  className="h-24 w-24 rounded-full border-4 border-surface object-cover shadow-modal"
                  fallback={
                    <span className="grid h-24 w-24 place-items-center rounded-full border-4 border-surface bg-grad-create text-[34px] font-extrabold text-[color:var(--grad-create-fg)] shadow-modal">
                      {initial}
                    </span>
                  }
                />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-full border-4 border-surface bg-grad-create text-[34px] font-extrabold text-[color:var(--grad-create-fg)] shadow-modal">
                  {initial}
                </span>
              )}
              <ProfileImageUpload
                kind="avatar"
                className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-surface-2 text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 9a2 2 0 0 1 2-2h2l1.5-2h7L19 7h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <circle cx="12" cy="13" r="3.2" />
                </svg>
              </ProfileImageUpload>
            </div>

            {/* handle + 操作 */}
            <div className="flex min-w-0 items-center gap-3 pb-1">
              <h1 className="truncate text-[26px] font-extrabold tracking-tight text-ink sm:text-[28px]">{handle}</h1>
              <ProfileActions />
            </div>

            {/* 统计（Plays 真实；Followers/Following 待社交系统） */}
            <div className="ml-auto flex gap-2.5 pb-1">
              {stats.map((s) => (
                <div key={s.label} className="min-w-[86px] rounded-lg border border-hairline bg-surface-inset px-4 py-2.5 text-center">
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
          收藏
        </TabLink>
        <TabLink href="/me?tab=created" active={tab === "created"}>
          作品
        </TabLink>
        <TabLink href="/me?tab=tasks" active={tab === "tasks"}>
          生成记录
        </TabLink>
      </div>

      {/* content */}
      {tab === "tasks" ? (
        tasks.length === 0 ? (
          <EmptyState title="还没有生成记录" desc="在 Create 里输入一个创意，生成的每个任务都会记录在这里。" />
        ) : (
          <TaskHistoryList tasks={tasks} />
        )
      ) : tab === "favorites" ? (
        favorites.length === 0 ? (
          <EmptyState title="还没有收藏的游戏" desc="喜欢的游戏点卡片上的书签收藏，就会出现在这里。" />
        ) : (
          <Grid games={favorites} favSet={favSet} refreshOnToggle />
        )
      ) : published.length === 0 ? (
        <EmptyState title="还没有作品" desc={draftCount > 0 ? `有 ${draftCount} 个草稿还没发布。` : "用 AI 把点子跑成可玩游戏。"} />
      ) : (
        <Grid games={published} favSet={favSet} />
      )}
    </div>
  );
}

// 生成任务历史（加分项）：状态徽章 + 创意 + 模型/时间 + 失败重试 / 查看产物。
const TASK_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "排队中", color: "var(--canceled)" },
  RUNNING: { label: "生成中", color: "var(--running)" },
  SUCCEEDED: { label: "已完成", color: "var(--ok)" },
  FAILED: { label: "失败", color: "var(--danger)" },
  CANCELED: { label: "已取消", color: "var(--canceled)" },
};

function TaskHistoryList({ tasks }: { tasks: TaskHistoryItem[] }) {
  // 生成成本统计（加分项）：本页任务的 token 合计 + 估算美元成本。
  const totalTokens = tasks.reduce((s, t) => s + t.totalTokens, 0);
  const totalCost = estimateCostUsd(totalTokens);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-inset px-4 py-2.5 text-[12px]">
        <span className="text-ink-muted">
          共 <span className="font-bold text-ink">{tasks.length}</span> 个生成任务
        </span>
        <span className="font-mono text-ink-muted">
          累计 <span className="font-bold text-ink">{totalTokens.toLocaleString()}</span> tokens · 估算成本 ≈ $
          <span className="font-bold text-ink">{totalCost.toFixed(4)}</span>
        </span>
      </div>
      <ul className="flex flex-col gap-2">
      {tasks.map((t) => {
        const s = TASK_STATUS[t.status] ?? { label: t.status, color: "var(--text-muted)" };
        return (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-hairline bg-surface px-4 py-3"
          >
            <span
              className="shrink-0 rounded-pill px-2.5 py-0.5 font-mono text-[11px] font-medium"
              style={{ color: s.color, border: `1px solid ${s.color}`, opacity: 0.95 }}
            >
              {s.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-ink" title={t.prompt}>
              {t.prompt || "（无创意文本）"}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-ink-faint">
              {t.modelProvider ? `${t.modelProvider} · ` : ""}
              {t.createdAt.slice(0, 16).replace("T", " ")}
              {t.totalTokens ? ` · ${t.totalTokens.toLocaleString()} tok` : ""}
              {t.attempt > 0 ? ` · 重试${t.attempt}` : ""}
            </span>
            <span className="shrink-0">
              {t.status === "SUCCEEDED" && t.gameId ? (
                <Link
                  href={t.gamePublished ? `/games/${t.gameId}` : `/play/${t.gameId}`}
                  className="rounded-pill border border-hairline-strong px-3 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  查看产物
                </Link>
              ) : t.status === "FAILED" ? (
                <TaskRetryButton taskId={t.id} />
              ) : t.status === "RUNNING" || t.status === "PENDING" ? (
                <Link
                  href="/create"
                  className="rounded-pill border border-hairline-strong px-3 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  去看进度
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
      </ul>
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

function Grid({
  games,
  favSet,
  refreshOnToggle = false,
}: {
  games: GameCardData[];
  favSet: Set<string>;
  refreshOnToggle?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {games.map((g) => (
        <GameCard key={g.id} game={g} showBookmark favorited={favSet.has(g.id)} refreshOnToggle={refreshOnToggle} />
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
        去发现游戏
      </Button>
    </div>
  );
}
