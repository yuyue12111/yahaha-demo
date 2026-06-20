import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/contracts/error";
import { PlayEventRequest, PlayEventResponse } from "@/lib/contracts/play-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/play-events（docs/06 §postMessage + docs/08 §可观测）—— Play 运行时埋点回写。
 * 公开（游玩无需登录）。type=LOAD 时 Game.playCount 自增（一次加载 = 一次游玩）。
 * userId 若有 session 则附带（best-effort；PlayEvent.userId 无 FK，stale 会话也不会 500）。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "请求体非合法 JSON"), { status: 422 });
  }
  const parsed = PlayEventRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "参数校验失败", { issues: parsed.error.flatten() }),
      { status: 422 },
    );
  }
  const { gameId, versionId, type, score, durationMs } = parsed.data;

  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
  if (!game) {
    return NextResponse.json(errorEnvelope("NOT_FOUND", "游戏不存在"), { status: 404 });
  }

  // versionId 有 FK → 仅当确属该游戏时才落库，否则置 null（防 P2003，且不信任客户端 id）。
  let safeVersionId: string | null = null;
  if (versionId) {
    const v = await prisma.version.findFirst({
      where: { id: versionId, gameId },
      select: { id: true },
    });
    safeVersionId = v?.id ?? null;
  }

  // userId 可选（无 FK）：有 session 就附带，便于后续按用户聚合；无需存在性校验。
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;

  await prisma.playEvent.create({
    data: { gameId, versionId: safeVersionId, userId, type, score, durationMs },
  });

  let playCount: number | undefined;
  if (type === "LOAD") {
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { playCount: { increment: 1 } },
      select: { playCount: true },
    });
    playCount = updated.playCount;
  }

  return NextResponse.json(PlayEventResponse.parse({ ok: true, ...(playCount != null ? { playCount } : {}) }));
}
