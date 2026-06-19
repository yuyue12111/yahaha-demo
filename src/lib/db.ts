import { PrismaClient } from "@prisma/client";

/**
 * Prisma client 单例。Next dev HMR 每次热重载都会重建模块，若每次 new 一个 client
 * 会耗尽连接池 → 用 globalThis 缓存。生产（standalone）每进程一个 client。
 * 全仓 DB 访问只经此文件（与 storage.ts 同精神：单一出入口）。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
