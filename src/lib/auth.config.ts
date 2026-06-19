import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe 基座（无 Prisma / bcrypt）：middleware 用它解码 JWT + 守 /create。
 * 真正的 Credentials.authorize（用 Prisma + bcrypt）在 auth.ts，只在 Node 路由跑 —— Prisma 绝不上 Edge。
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      // token.uid 来自 @auth/core JWT 的 index 签名（unknown）；cast 落到 string（d.ts 增强在 v5 beta 不稳）
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
