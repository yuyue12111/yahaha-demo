import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/contracts/error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/games/:id/favorite —— 切换收藏（书签）。登录必需；游戏须已发布。
 * 已收藏→删，未收藏→建（@@unique[userId,gameId] 保幂等）。返回 { favorited }。
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const userId = gate.user.id;
  const { id: gameId } = await params;

  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { status: true } });
  if (!game || game.status !== "PUBLISHED") {
    return NextResponse.json(errorEnvelope("NOT_FOUND", "游戏不存在或未发布"), { status: 404 });
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_gameId: { userId, gameId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }
  await prisma.favorite.create({ data: { userId, gameId } });
  return NextResponse.json({ favorited: true });
}
