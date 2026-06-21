import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { DEMO_OAUTH_CODE, DEMO_OAUTH_TOKEN } from "@/lib/demo-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo OAuth IdP — token endpoint。NextAuth 服务端用 code 换 token（application/x-www-form-urlencoded）。
 * 校验 code 后返回标准 OAuth2 token 响应（token_type=bearer）。client_secret/code_verifier(PKCE) 忽略（演示用）。
 */
export async function POST(req: Request): Promise<Response> {
  if (!env.ENABLE_DEMO_OAUTH) return NextResponse.json({ error: "disabled" }, { status: 404 });

  let code: string | null = null;
  try {
    const form = await req.formData();
    code = (form.get("code") as string | null) ?? null;
  } catch {
    code = null;
  }
  if (code !== DEMO_OAUTH_CODE) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  return NextResponse.json({
    access_token: DEMO_OAUTH_TOKEN,
    token_type: "bearer",
    expires_in: 3600,
    scope: "openid email profile",
  });
}
