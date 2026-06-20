import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/me（docs/03:20）：出当前用户；未登录 / 会话失效 → 401 信封（requireUser 统一）。
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;
  const { id, email, displayName } = gate.user;
  return NextResponse.json({ user: { id, email, displayName } });
}
