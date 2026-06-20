import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deletePrefix } from "@/lib/storage";
import { requireGameOwner } from "@/lib/require-game-owner";
import { errorEnvelope } from "@/lib/contracts/error";
import { GameDetail, GameUpdateRequest } from "@/lib/contracts/games";
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

  // 非作者不可见草稿/归档（不枚举）：PUBLISHED 对所有人公开；DRAFT/ARCHIVED 仅作者本人，否则 404。
  if (game.status !== "PUBLISHED") {
    const session = await auth().catch(() => null);
    if (session?.user?.id !== game.author.id) {
      return NextResponse.json(errorEnvelope("NOT_FOUND", "游戏不存在"), { status: 404 });
    }
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

/**
 * PATCH /api/games/:id（T2-1）—— 作者改 meta（title/summary/tags）。仅作者（403）。
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireGameOwner(id);
  if (!owner.ok) return owner.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "请求体非合法 JSON"), { status: 422 });
  }
  const parsed = GameUpdateRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "参数校验失败", { issues: parsed.error.flatten() }),
      { status: 422 },
    );
  }

  await prisma.game.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/games/:id（T2-1）—— 作者删除游戏：级联删 Version/PlayEvent/Like/Favorite（Prisma），
 * 再清 MinIO 产物 `games/{id}/`（best-effort）。仅作者（403）。
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireGameOwner(id);
  if (!owner.ok) return owner.response;

  // 先删 DB 行（权威态）：Version/PlayEvent/Like/Favorite 经 onDelete:Cascade 一并删，Task/Asset.gameId 置空。
  await prisma.game.delete({ where: { id } });
  // 再清远端产物（孤儿对象无害；失败只记录，不让 500 误导“未删除”）。
  await deletePrefix(`games/${id}/`).catch((e) =>
    console.error(`[games.DELETE] deletePrefix games/${id}/ failed:`, e?.message ?? e),
  );
  return NextResponse.json({ ok: true });
}
