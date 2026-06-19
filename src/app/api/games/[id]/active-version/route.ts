import { NextResponse } from "next/server";
import { resolveActiveVersion, type ResolveError } from "@/lib/active-version";
import { errorEnvelope, type ErrorCode } from "@/lib/contracts/error";

// Reads from MinIO at request time — never statically optimized.
export const dynamic = "force-dynamic";

// 内部解析错误 → docs/03 统一错误信封的 code/status（MED-6）。
const ERROR_MAP: Record<ResolveError, { status: number; code: ErrorCode; message: string }> = {
  GAME_NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "未找到该游戏" },
  MANIFEST_UNAVAILABLE: { status: 502, code: "INTERNAL", message: "远端清单不可读" },
  ENTRY_NOT_FOUND: { status: 502, code: "INTERNAL", message: "入口产物缺失" },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await resolveActiveVersion(id);
  if (!result.ok) {
    const m = ERROR_MAP[result.error];
    return NextResponse.json(
      errorEnvelope(m.code, m.message, {
        reason: result.error,
        ...(result.detail ? { detail: result.detail } : {}),
      }),
      { status: m.status },
    );
  }
  return NextResponse.json(result.data);
}
