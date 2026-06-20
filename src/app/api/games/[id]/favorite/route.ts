import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

  // 幂等并发安全：取消用 deleteMany（无则 0 行，不抛）；新增 create 捕获 P2002（并发已建）当作已收藏。
  // 避免 check-then-act 在双击/多标签并发下撞 @@unique 抛未包装 500。
  const existing = await prisma.favorite.findUnique({
    where: { userId_gameId: { userId, gameId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.deleteMany({ where: { userId, gameId } });
    return NextResponse.json({ favorited: false });
  }
  try {
    await prisma.favorite.create({ data: { userId, gameId } });
    return NextResponse.json({ favorited: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ favorited: true }); // 并发已建 → 幂等返回已收藏
    }
    throw e;
  }
}
