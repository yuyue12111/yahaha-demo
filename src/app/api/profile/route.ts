import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/db";
import { publicUrl } from "@/lib/storage";
import { errorEnvelope } from "@/lib/contracts/error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/profile —— 更新当前用户资料（displayName / avatarUrl / bannerUrl）。
 * 图片 URL 必须落在本人 profile 前缀（防止设置任意外链）。返回更新后的精简资料。
 */
export async function PATCH(req: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const userId = gate.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "请求体非合法 JSON"), { status: 422 });
  }
  const b = body as { displayName?: unknown; avatarUrl?: unknown; bannerUrl?: unknown };

  // 本人 profile 公开前缀，例如 http://localhost:9000/yahaha/profile/<userId>/
  const ownPrefix = publicUrl(`profile/${userId}/`);
  const data: { displayName?: string; avatarUrl?: string; bannerUrl?: string } = {};

  if (typeof b.displayName === "string") {
    const name = b.displayName.trim();
    if (name.length < 1 || name.length > 40) {
      return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "昵称需 1–40 字"), { status: 422 });
    }
    data.displayName = name;
  }
  for (const field of ["avatarUrl", "bannerUrl"] as const) {
    const v = b[field];
    if (v === undefined) continue;
    if (typeof v !== "string" || !v.startsWith(ownPrefix)) {
      return NextResponse.json(errorEnvelope("VALIDATION_ERROR", `${field} 必须是你上传的 profile 图`), { status: 422 });
    }
    data[field] = v;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "无可更新字段"), { status: 422 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, displayName: true, avatarUrl: true, bannerUrl: true },
  });
  return NextResponse.json({ user });
}
