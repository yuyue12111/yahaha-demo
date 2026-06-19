import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorEnvelope } from "@/lib/contracts/error";

export const dynamic = "force-dynamic";

// GET /api/me（docs/03:20）：从 session 出当前用户；未登录 401 信封。
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(errorEnvelope("UNAUTHORIZED", "未登录"), { status: 401 });
  }
  return NextResponse.json({
    user: { id: session.user.id, email: session.user.email, displayName: session.user.name },
  });
}
