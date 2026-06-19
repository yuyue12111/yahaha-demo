# Multi-stage; web + (future) worker share this image. Next.js standalone output → slim runner.
# node digest-pinned for reproducible builds (MED-3 / Fatal #5).
FROM node:22-alpine@sha256:ab07539e0988b63558ff621f5fbe1077054c39d9809112974fb79993949d41cd AS base
RUN corepack enable
WORKDIR /app

# ---- deps ----
FROM base AS deps
# include .npmrc + pnpm-workspace.yaml so the build-script allowlist (sharp/unrs-resolver) applies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---- builder ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# build 期占位（不会被连接；runtime 由 compose env 覆盖）——避免 PrismaClient/NextAuth 构造期 env 检查
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV AUTH_SECRET="build-only-not-a-secret"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# ---- runner ----
FROM node:22-alpine@sha256:ab07539e0988b63558ff621f5fbe1077054c39d9809112974fb79993949d41cd AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Prisma library engine 在 musl 上需要这两个库；否则运行期加载 .so.node 失败
RUN apk add --no-cache libc6-compat openssl
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# standalone mode does NOT auto-copy these — must be explicit
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Next standalone 的 nft 追踪会漏 Prisma 引擎 .so.node + 生成的 client → 显式补上
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
