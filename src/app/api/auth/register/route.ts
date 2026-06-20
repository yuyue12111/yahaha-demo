import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { RegisterSchema } from "@/lib/contracts/auth";
import { errorEnvelope } from "@/lib/contracts/error";
import { rateLimitAuth } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 按 IP 限流（fail-open）：挡 bcrypt 放大 DoS + 无限建号。先于 JSON 解析与 bcrypt。
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  const rl = await rateLimitAuth(`ip:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      errorEnvelope("RATE_LIMITED", "注册过于频繁，请稍后再试", { retryAfterSec: rl.retryAfterSec }),
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", "请求体不是合法 JSON"), { status: 422 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorEnvelope("VALIDATION_ERROR", "注册信息不合法", {
        issues: parsed.error.flatten().fieldErrors,
      }),
      { status: 422 },
    );
  }

  const { email, password, displayName } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        accounts: { create: { provider: "CREDENTIALS", providerAccountId: email } },
      },
      select: { id: true, email: true, displayName: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(errorEnvelope("CONFLICT", "该邮箱已注册"), { status: 409 });
    }
    return NextResponse.json(errorEnvelope("INTERNAL", "注册失败"), { status: 500 });
  }
}
