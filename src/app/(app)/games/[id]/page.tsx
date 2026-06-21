import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveActiveVersion } from "@/lib/active-version";
import { Button } from "@/components/ui/Button";
import { RemoteImg } from "@/components/ui/RemoteImg";
import { GameManagePanel } from "@/components/game/GameManagePanel";
import { LikeButton } from "@/components/game/LikeButton";
import { BookmarkButton } from "@/components/game/BookmarkButton";
import { RefinePanel } from "@/components/game/RefinePanel";

// 单游戏详情页（T3）：承载玩法提示（T1）+ 统计 + 立即游玩 + 作者管理面板（T2-1）。
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已下架",
};

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [game, active, liked, favorited, latestVersion] = await Promise.all([
    prisma.game.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true } },
        _count: { select: { likes: true, favorites: true } },
      },
    }),
    resolveActiveVersion(id),
    // 当前用户对本游戏的 点赞/收藏 态（未登录 → null，按钮以未激活态渲染、点击引导登录）。
    userId
      ? prisma.like.findUnique({ where: { userId_gameId: { userId, gameId: id } }, select: { id: true } })
      : Promise.resolve(null),
    userId
      ? prisma.favorite.findUnique({ where: { userId_gameId: { userId, gameId: id } }, select: { id: true } })
      : Promise.resolve(null),
    // 最新 version id（草稿发布用）：作者在详情页一键发布最新版本。
    prisma.version.findFirst({
      where: { gameId: id },
      orderBy: { versionNumber: "desc" },
      select: { id: true },
    }),
  ]);

  if (!game) notFound();
  const isOwner = !!(session?.user && session.user.id === game.author.id);
  // 非作者不可见草稿/归档（与 GET /api/games/:id 一致）。
  if (game.status !== "PUBLISHED" && !isOwner) notFound();

  const controls = active.ok ? active.data.controls : "";
  const publishedDate = game.publishedAt ? game.publishedAt.toISOString().slice(0, 10) : null;
  const initial = game.author.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/" className="text-[13px] text-ink-muted transition-colors hover:text-ink">
        ← 返回首页
      </Link>

      <div className="grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
        {/* 封面 */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-hairline-brand bg-surface-inset">
          {game.coverUrl ? (
            <RemoteImg
              src={game.coverUrl}
              alt={game.title}
              className="h-full w-full object-cover"
              fallback={<div className="h-full w-full bg-grad-play opacity-30" aria-hidden />}
            />
          ) : (
            <div className="h-full w-full bg-grad-play opacity-30" aria-hidden />
          )}
        </div>

        {/* 元信息 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[22px] font-bold leading-tight text-ink">{game.title}</h1>
            {game.status !== "PUBLISHED" ? (
              <span className="shrink-0 rounded-pill border border-hairline px-2 py-0.5 text-[11px] text-ink-muted">
                {STATUS_LABEL[game.status] ?? game.status}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[10px] font-medium" aria-hidden>
              {initial}
            </span>
            <span>{game.author.displayName}</span>
            {publishedDate ? <span className="text-ink-faint">· {publishedDate}</span> : null}
          </div>

          <div className="flex items-center gap-3 font-mono text-[12px] text-ink-muted">
            <span>▶ {game.playCount} 次游玩</span>
          </div>

          {game.summary ? <p className="text-sm leading-relaxed text-ink-muted">{game.summary}</p> : null}

          {game.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {game.tags.map((t) => (
                <Link
                  key={t}
                  href={`/?tag=${encodeURIComponent(t)}`}
                  className="rounded-pill border border-hairline px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
                >
                  {t}
                </Link>
              ))}
            </div>
          ) : null}

          {/* 玩法提示（T1） */}
          {controls ? (
            <p className="flex items-start gap-1.5 rounded-md border border-hairline bg-surface-inset px-3 py-2 text-[12px] text-ink-muted">
              <span className="shrink-0 text-ink-faint">玩法</span>
              <span>{controls}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {active.ok ? (
              <Button href={`/play/${game.id}`} variant="play" size="md">
                ▶ 立即游玩
              </Button>
            ) : (
              <span className="text-[13px] text-ink-faint">暂无可玩版本</span>
            )}
            {/* 点赞 / 收藏（Home 加分项；登录后真写，未登录引导登录） */}
            <LikeButton gameId={game.id} initialLiked={!!liked} initialCount={game._count.likes} />
            <BookmarkButton
              gameId={game.id}
              initialFavorited={!!favorited}
              tone="control"
              count={game._count.favorites}
            />
            {/* Remix 派生（加分项）：基于本游戏二次创作，去 Create 预填创意。 */}
            {game.status === "PUBLISHED" ? (
              <Link
                href={`/create?remix=${game.id}`}
                className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                ✦ Remix
              </Link>
            ) : null}
            {active.ok ? (
              <span className="ml-auto font-mono text-[11px] text-ink-faint">
                runtime {active.data.runtime} · v{active.data.versionNumber}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 作者管理（T2-1 owner-scoped）+ 自然语言微调 */}
      {isOwner ? (
        <>
          {latestVersion ? <RefinePanel gameId={game.id} /> : null}
          <GameManagePanel
            gameId={game.id}
            status={game.status}
            initial={{ title: game.title, summary: game.summary, tags: game.tags }}
            publishVersionId={latestVersion?.id ?? null}
          />
        </>
      ) : null}
    </div>
  );
}
