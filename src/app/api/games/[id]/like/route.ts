import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/contracts/error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/games/:id/like —— 切换点赞。登录必需；游戏须已发布。
 * 已赞→删，未赞→建（@@unique[userId,gameId] 保幂等）。返回 { liked, likes }（含最新计数，按钮直显）。
 * 幂等并发安全：与 favorite 同范式（取消 deleteMany 不抛、新增 create 捕 P2002 当已赞），避免 check-then-act 撞 @@unique 抛 500。
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

  const existing = await prisma.like.findUnique({
    where: { userId_gameId: { userId, gameId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.like.deleteMany({ where: { userId, gameId } });
    const likes = await prisma.like.count({ where: { gameId } });
    return NextResponse.json({ liked: false, likes });
  }
  try {
    await prisma.like.create({ data: { userId, gameId } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    // 并发已建 → 幂等当作已赞，继续返回最新计数。
  }
  const likes = await prisma.like.count({ where: { gameId } });
  return NextResponse.json({ liked: true, likes });
}
