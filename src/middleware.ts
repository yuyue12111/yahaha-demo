import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge middleware：仅 JWT 解码（authConfig 无 Prisma）。手动 redirect 保 `?next=` 契约（docs/03）。
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuthed = !!req.auth?.user;
  if (!isAuthed && req.nextUrl.pathname.startsWith("/create")) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("next", req.nextUrl.pathname);
    return Response.redirect(url);
  }
  return undefined;
});

// 只在 /create 下跑（不碰 /api/auth、静态资源、其它公共页）
export const config = { matcher: ["/create/:path*"] };
