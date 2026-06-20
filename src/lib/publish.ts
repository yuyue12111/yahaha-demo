import { prisma } from "./db";

/**
 * 发布逻辑（docs/05 §版本与发布）—— 被 `POST /api/games/:id/publish` 路由与 seed 共用。
 * 原子置 Version→PUBLISHED + Game(status=PUBLISHED, activeVersionId, publishedAt)。
 * 仅作者可发布（越权 403）；version 必须属于该 game。幂等：重复发布同 version 无副作用、保留首次 publishedAt。
 * 回滚/切换 = 发布另一个 version（改 activeVersionId，保留 publishedAt）。
 */
export type PublishError = "GAME_NOT_FOUND" | "VERSION_NOT_FOUND" | "FORBIDDEN";
export type PublishResult =
  | { ok: true; gameId: string; activeVersionId: string; publishedAt: Date }
  | { ok: false; status: number; error: PublishError };

export async function publishGameVersion(opts: {
  gameId: string;
  versionId: string;
  userId: string;
}): Promise<PublishResult> {
  const { gameId, versionId, userId } = opts;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, authorId: true, publishedAt: true },
  });
  if (!game) return { ok: false, status: 404, error: "GAME_NOT_FOUND" };
  if (game.authorId !== userId) return { ok: false, status: 403, error: "FORBIDDEN" };

  const version = await prisma.version.findUnique({
    where: { id: versionId },
    select: { id: true, gameId: true },
  });
  if (!version || version.gameId !== gameId) {
    return { ok: false, status: 404, error: "VERSION_NOT_FOUND" };
  }

  const publishedAt = game.publishedAt ?? new Date(); // 首次发布才盖时间戳
  await prisma.$transaction([
    prisma.version.update({ where: { id: versionId }, data: { status: "PUBLISHED" } }),
    prisma.game.update({
      where: { id: gameId },
      data: { status: "PUBLISHED", activeVersionId: versionId, publishedAt },
    }),
  ]);

  return { ok: true, gameId, activeVersionId: versionId, publishedAt };
}
