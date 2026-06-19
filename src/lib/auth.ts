import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "./db";
import { LoginSchema } from "./contracts/auth";

/**
 * 完整 NextAuth（Node 端）：在 Edge-safe 基座上加 Credentials provider，
 * 其 authorize 用 Prisma + bcryptjs 校验邮箱+密码。authorize 只在 /api/auth 路由（Node）触发。
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl ?? null,
        };
      },
    }),
  ],
});
