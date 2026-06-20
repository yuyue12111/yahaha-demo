import { NextResponse } from "next/server";
import { requireUser } from "./require-user";
import { prisma } from "./db";
import { errorEnvelope } from "./contracts/error";

/**
 * 作者守卫（T2-1 owner-scoped 管理）—— 登录 + 存在（requireUser）+ 是该游戏作者，
 * 否则返回相应错误响应。供 PATCH / DELETE / archive 等作者管理端点共用。
 */
export type GameOwnerResult =
  | { ok: true; gameId: string; userId: string }
  | { ok: false; response: NextResponse };

export async function requireGameOwner(id: string): Promise<GameOwnerResult> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, response: gate.response };

  const game = await prisma.game.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!game) {
    return {
      ok: false,
      response: NextResponse.json(errorEnvelope("NOT_FOUND", "游戏不存在"), { status: 404 }),
    };
  }
  if (game.authorId !== gate.user.id) {
    return {
      ok: false,
      response: NextResponse.json(errorEnvelope("FORBIDDEN", "非作者，禁止操作"), { status: 403 }),
    };
  }
  return { ok: true, gameId: id, userId: gate.user.id };
}
