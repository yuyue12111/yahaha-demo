import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { env } from "./env";
import { prisma } from "./db";
import { LoginSchema } from "./contracts/auth";

/**
 * 完整 NextAuth（Node 端）：Edge-safe 基座 + Credentials（邮箱+密码）+ env-gated OAuth（Google/GitHub）。
 * 全部 provider 的回调（含下方读 Prisma 的 jwt）只在 /api/auth 路由（Node）触发；middleware 走 auth.config（无 Prisma）→ Prisma 绝不上 Edge。
 */

/** 哪些 OAuth provider 已配齐凭据（登录页据此渲染按钮）。缺凭据 → 不启用，邮箱登录照常（红线⑤）。 */
export const oauthEnabled = {
  google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  github: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
};

type OAuthProfile = {
  email?: string | null;
  name?: string | null;
  login?: string;
  picture?: string;
  avatar_url?: string;
};

/**
 * OAuth 账号绑定（JWT 策略 + 无 DB adapter → 手动落库，数据模型见 docs/02 Account）：
 *  1) 按 (provider, providerAccountId) 找已绑 Account → 命中即复用其 User（重复登录稳定同一身份）。
 *  2) 否则按 email upsert User（同邮箱的 Credentials 账号可被绑定），再建 Account 行存 token。
 * GitHub 邮箱可能私密 → 合成稳定占位邮箱，保证 User.email 非空唯一。返回我方 DB User。
 */
async function linkOAuthAccount(
  provider: "google" | "github",
  providerAccountId: string,
  profile: OAuthProfile,
  tokens: { access_token?: string; refresh_token?: string; expires_at?: number },
) {
  const providerEnum = provider === "google" ? "GOOGLE" : "GITHUB";
  const bound = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: providerEnum, providerAccountId } },
    include: { user: true },
  });
  if (bound) return bound.user;

  const email = profile.email || `${provider}_${providerAccountId}@oauth.local`;
  const displayName = profile.name || profile.login || email.split("@")[0];
  const avatarUrl = profile.picture ?? profile.avatar_url ?? null;

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, displayName, avatarUrl },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      provider: providerEnum,
      providerAccountId,
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expires_at ?? null,
    },
  });
  return user;
}

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
    // env-gated：配齐 id+secret 才注册。回调 URL = /api/auth/callback/{google,github}。
    ...(oauthEnabled.google
      ? [Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })]
      : []),
    ...(oauthEnabled.github
      ? [GitHub({ clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET })]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Node 端 jwt：在 Edge-safe 基座之上补 OAuth 账号绑定（读 Prisma）。落到 token.uid = 我方 DB User.id。
    async jwt({ token, user, account, profile }) {
      if (token.uid) return token; // 后续请求：已带 uid，直接放行
      if (account?.provider === "credentials") {
        if (user?.id) token.uid = user.id; // authorize 返回的就是 DB id
        return token;
      }
      if (account && (account.provider === "google" || account.provider === "github") && profile) {
        const dbUser = await linkOAuthAccount(
          account.provider,
          account.providerAccountId,
          profile as OAuthProfile,
          {
            access_token: account.access_token as string | undefined,
            refresh_token: account.refresh_token as string | undefined,
            expires_at: account.expires_at as number | undefined,
          },
        );
        token.uid = dbUser.id;
        return token;
      }
      if (user?.id) token.uid = user.id; // 兜底
      return token;
    },
  },
});
