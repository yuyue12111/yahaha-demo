import { resolveActiveVersion } from "@/lib/active-version";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PlayShell } from "@/components/play/PlayShell";

// Resolves the manifest from MinIO per request (server-side, no CORS).
export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // B2：作者本人玩自己的游戏时给出「生成新版本」入口（→ /create?gameId）。
  const [result, game, session] = await Promise.all([
    resolveActiveVersion(id),
    prisma.game.findUnique({ where: { id }, select: { authorId: true } }),
    auth(),
  ]);
  const isOwner = !!(session?.user && game && game.authorId === session.user.id);

  return (
    <PlayShell
      gameId={id}
      active={result.ok ? result.data : null}
      resolveError={
        result.ok ? null : { status: result.status, error: result.error, detail: result.detail ?? null }
      }
      regenHref={isOwner ? `/create?gameId=${id}` : null}
      detailHref={`/games/${id}`}
    />
  );
}
