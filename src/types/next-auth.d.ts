import type { DefaultSession } from "next-auth";

// 给 session.user 加 id，给 JWT 加 uid（auth.config.ts 的 callbacks 注入）。
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
  }
}
