import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireGameOwner } from "@/lib/require-game-owner";
import { errorEnvelope } from "@/lib/contracts/error";
import { GameArchiveRequest } from "@/lib/contracts/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/games/:id/archive（T2-1）—— 作者下架/恢复。仅作者（403）。
 * archived=true → `ARCHIVED`（Home 查询天然排除）；archived=false → 恢复（有 activeVersion 则 PUBLISHED，否则 DRAFT）。
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireGameOwner(id);
  if (!owner.ok) return owner.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "请求体非合法 JSON"), { status: 422 });
  }
  const parsed = GameArchiveRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "参数校验失败", { issues: parsed.error.flatten() }),
      { status: 422 },
    );
  }

  const game = await prisma.game.findUnique({
    where: { id },
    select: { activeVersionId: true },
  });
  const restoredStatus = game?.activeVersionId ? "PUBLISHED" : "DRAFT";
  const status = parsed.data.archived ? "ARCHIVED" : restoredStatus;

  await prisma.game.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true, status });
}
