import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { DEMO_OAUTH_TOKEN, DEMO_OAUTH_USER } from "@/lib/demo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo OAuth IdP — userinfo endpoint。NextAuth 用 Bearer token GET，拿到 profile → provider.profile() 映射 → jwt 回调绑定。
 */
export async function GET(req: Request): Promise<Response> {
  if (!env.ENABLE_DEMO_OAUTH) return NextResponse.json({ error: "disabled" }, { status: 404 });

  const authz = req.headers.get("authorization") ?? "";
  if (!authz.includes(DEMO_OAUTH_TOKEN)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json(DEMO_OAUTH_USER);
}
