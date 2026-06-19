import { handlers } from "@/lib/auth";

// NextAuth 的 sign-in/sign-out/callback 路由（Node 运行时，Credentials.authorize 在此触发）。
export const { GET, POST } = handlers;
