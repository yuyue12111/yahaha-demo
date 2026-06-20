import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { errorEnvelope, type ErrorCode } from "@/lib/contracts/error";
import { PublishRequest, PublishResponse } from "@/lib/contracts/publish";
import { publishGameVersion, type PublishError } from "@/lib/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR_MAP: Record<PublishError, { status: number; code: ErrorCode; message: string }> = {
  GAME_NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "游戏不存在" },
  VERSION_NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "版本不存在或不属于该游戏" },
  FORBIDDEN: { status: 403, code: "FORBIDDEN", message: "非作者，禁止发布" },
};

/**
 * POST /api/games/:id/publish（docs/03:33）—— 作者发布某 version：Game→PUBLISHED + activeVersionId + publishedAt。
 * 发布后该游戏经 Home 查库出现、经 active-version 解析进 Play。
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "请求体非合法 JSON"), { status: 422 });
  }
  const parsed = PublishRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "参数校验失败", { issues: parsed.error.flatten() }),
      { status: 422 },
    );
  }

  const r = await publishGameVersion({
    gameId: id,
    versionId: parsed.data.versionId,
    userId: gate.user.id,
  });
  if (!r.ok) {
    const m = ERROR_MAP[r.error];
    return NextResponse.json(errorEnvelope(m.code, m.message, { reason: r.error }), {
      status: m.status,
    });
  }

  return NextResponse.json(
    PublishResponse.parse({
      gameId: r.gameId,
      status: "PUBLISHED",
      activeVersionId: r.activeVersionId,
      publishedAt: r.publishedAt.toISOString(),
    }),
  );
}
