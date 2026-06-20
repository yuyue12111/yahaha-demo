import { NextResponse } from "next/server";
import { auth } from "./auth";
import { prisma } from "./db";
import { errorEnvelope } from "./contracts/error";

/**
 * Node-only 登录守卫（docs/03 §鉴权 + docs/07 §会话）。
 *
 * `auth()` 只解码 JWT —— token 已签名且未过期就判为已登录，但 token 里的 `uid`
 * 未必仍对应 User 表里的行（库被重置 / 用户被删 / 旧 cookie）。此时若直接拿
 * `session.user.id` 去写库（GenerationTask / Asset…），会撞外键约束 → Prisma P2003
 * → 未捕获 500。这里在 `auth()` 之后**再核对该用户确实存在**，把这种「签名仍合法但
 * 已失效」的会话统一收成干净 401「请重新登录」，而不是 500。
 *
 * Prisma 绝不上 Edge —— 仅在 Node 路由调用；middleware 仍用 `auth.config` 的纯 JWT 解码守 /create。
 */
export type AuthedUser = { id: string; email: string | null; displayName: string | null };

export type RequireUserResult =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse };

function unauthorized(message: string): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json(errorEnvelope("UNAUTHORIZED", message), { status: 401 }),
  };
}

export async function requireUser(): Promise<RequireUserResult> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return unauthorized("未登录");

  // 签名仍合法但用户已不存在（库重置 / 删号）→ 干净 401，而非后续写库 FK 500。
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, displayName: true },
  });
  if (!user) return unauthorized("会话已失效，请重新登录");

  return { ok: true, user };
}
