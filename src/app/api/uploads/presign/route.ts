import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { presignGet, presignPut } from "@/lib/storage";
import { errorEnvelope } from "@/lib/contracts/error";
import { PresignRequest, PresignResponse, extFor, isAllowedUploadType } from "@/lib/contracts/uploads";
import { rateLimitPresign } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRES_IN = 300;

/**
 * POST /api/uploads/presign（docs/03 §Uploads + docs/07 §2）—— presigned 直传。
 * 建 Asset(UPLOAD) 占位拿 cuid → key=uploads/{userId}/{assetId}.{ext} → 返回 putUrl（浏览器直传 MinIO）。
 * 类型白名单（415）、大小限额（413）。app 绝不经手字节。
 */
export async function POST(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const userId = gate.user.id;

  // per-user 限流（fail-open）：挡循环建占位 Asset 行膨胀。
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
  const parsed = PresignRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "参数校验失败", { issues: parsed.error.flatten() }),
      { status: 422 },
    );
  }
  const { filename, contentType, bytes } = parsed.data;

  if (!isAllowedUploadType(contentType)) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", `不支持的类型：${contentType}`, { contentType }),
      { status: 415 },
    );
  }
  if (bytes > env.MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", `文件过大（上限 ${env.MAX_UPLOAD_BYTES} 字节）`, {
        bytes,
        max: env.MAX_UPLOAD_BYTES,
      }),
      { status: 413 },
    );
  }

  const ext = extFor(filename, contentType);
  // 先建占位 Asset 拿 cuid，再据其 id 拼 key（uploads/{userId}/{assetId}.{ext}）。
  const asset = await prisma.asset.create({
    data: {
      ownerId: userId,
      kind: "UPLOAD",
      s3Key: "pending",
      contentType,
      bytes,
      originalFilename: filename,
    },
    select: { id: true },
  });
  const key = `uploads/${userId}/${asset.id}.${ext}`;
  await prisma.asset.update({ where: { id: asset.id }, data: { s3Key: key } });

  const [putUrl, getUrl] = await Promise.all([
    presignPut(key, contentType, EXPIRES_IN, bytes), // 绑 content-length → 限额不可绕过
    presignGet(key, EXPIRES_IN),
  ]);

  return NextResponse.json(
    PresignResponse.parse({ assetId: asset.id, key, putUrl, getUrl, expiresIn: EXPIRES_IN }),
  );
}
