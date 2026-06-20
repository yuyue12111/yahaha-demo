import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/require-user";
import { env } from "@/lib/env";
import { presignPut, publicUrl } from "@/lib/storage";
import { errorEnvelope } from "@/lib/contracts/error";
import { extFor, isAllowedUploadType } from "@/lib/contracts/uploads";
import { rateLimitPresign } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRES_IN = 300;

/**
 * POST /api/profile/image —— 头像/背景图 presigned 直传。
 * key = profile/{userId}/{kind}-{uuid}.{ext}（profile/* 公开可读 → 返回 publicUrl，<img> 直读）。
 * 仅图片类型、受 MAX_UPLOAD_BYTES 限额。app 绝不经手字节（红线①：storage 仅 storage.ts）。
 */
export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const userId = gate.user.id;

  const rl = await rateLimitPresign(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      errorEnvelope("RATE_LIMITED", "操作过于频繁，请稍后再试", { retryAfterSec: rl.retryAfterSec }),
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "请求体非合法 JSON"), { status: 422 });
  }
  const b = body as { kind?: unknown; filename?: unknown; contentType?: unknown; bytes?: unknown };
  const kind = b.kind === "banner" ? "banner" : b.kind === "avatar" ? "avatar" : null;
  const filename = typeof b.filename === "string" ? b.filename : "image";
  const contentType = typeof b.contentType === "string" ? b.contentType : "";
  const bytes = typeof b.bytes === "number" ? b.bytes : 0;

  if (!kind) {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "kind 必须为 avatar 或 banner"), { status: 422 });
  }
  if (!contentType.startsWith("image/") || !isAllowedUploadType(contentType)) {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", `仅支持图片，收到：${contentType}`, { contentType }), { status: 415 });
  }
  if (bytes > env.MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", `文件过大（上限 ${env.MAX_UPLOAD_BYTES} 字节）`, { bytes, max: env.MAX_UPLOAD_BYTES }),
      { status: 413 },
    );
  }

  const ext = extFor(filename, contentType);
  const key = `profile/${userId}/${kind}-${randomUUID()}.${ext}`;
  const putUrl = await presignPut(key, contentType, EXPIRES_IN, bytes); // 绑 content-length → 限额不可绕过

  return NextResponse.json({ kind, key, putUrl, publicUrl: publicUrl(key), expiresIn: EXPIRES_IN });
}
