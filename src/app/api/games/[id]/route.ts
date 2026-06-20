import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/contracts/error";
import { GameDetail } from "@/lib/contracts/games";
import { dbToWire } from "@/lib/contracts/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/games/:id（docs/03:31）—— 单游戏 meta + 作者 + 活跃版本摘要 + 统计。公开（无鉴权）。
 * stats 从 Like/Favorite/playCount 真查（like/favorite 写入仍 deferred，故 liked/favorited 不返回）。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, displayName: true } },
      activeVersion: { select: { id: true, versionNumber: true, runtime: true } },
      _count: { select: { likes: true, favorites: true } },
    },
  });
  if (!game) {
    return NextResponse.json(errorEnvelope("NOT_FOUND", "游戏不存在"), { status: 404 });
  }

  return NextResponse.json(
    GameDetail.parse({
      game: {
        id: game.id,
        title: game.title,
        summary: game.summary,
        tags: game.tags,
        coverUrl: game.coverUrl,
        status: game.status,
        publishedAt: game.publishedAt ? game.publishedAt.toISOString() : null,
        createdAt: game.createdAt.toISOString(),
      },
      author: { id: game.author.id, displayName: game.author.displayName },
      activeVersion: game.activeVersion
        ? {
            id: game.activeVersion.id,
            versionNumber: game.activeVersion.versionNumber,
            runtime: dbToWire(game.activeVersion.runtime),
          }
        : null,
      stats: {
        likes: game._count.likes,
        favorites: game._count.favorites,
        playCount: game.playCount,
      },
    }),
  );
}
