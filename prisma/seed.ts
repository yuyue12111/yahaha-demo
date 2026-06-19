import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * 幂等 seed：作者 → 2 预制游戏 → 2 版本 → 设 activeVersionId。
 * 在 compose `seed` 一次性服务里跑（`tsx prisma/seed.ts`）；bundle 已由 minio-init 上传到 MinIO。
 * coverUrl/manifestUrl 用 PUBLIC 端点（浏览器可达）。
 */
const prisma = new PrismaClient();

const S3_PUBLIC = (process.env.S3_PUBLIC_ENDPOINT || "http://localhost:9000").replace(/\/+$/, "");
const BUCKET = process.env.S3_BUCKET || "yahaha";
const publicUrl = (key: string) => `${S3_PUBLIC}/${BUCKET}/${key.replace(/^\/+/, "")}`;

const SEED_GAMES = [
  {
    id: "neon-dodger",
    title: "Neon Dodger",
    summary: "躲避坠落的霓虹方块，活得越久分越高。方向键 / A·D 或触屏移动。",
    tags: ["arcade", "dodge", "neon"],
  },
  {
    id: "star-catcher",
    title: "Star Catcher",
    summary: "移动接星器接住坠落的霓虹星，漏 3 颗结束。方向键 / A·D 或触屏移动。",
    tags: ["arcade", "catch", "neon"],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("yahaha-demo", 10);
  const author = await prisma.user.upsert({
    where: { email: "studio@yahaha.dev" },
    update: {},
    create: { email: "studio@yahaha.dev", displayName: "Yahaha Studio", passwordHash },
  });

  // 邮箱用户也建一条 CREDENTIALS account（providerAccountId=email，与注册路径一致，docs/02 §Account）
  await prisma.account.upsert({
    where: { provider_providerAccountId: { provider: "CREDENTIALS", providerAccountId: author.email } },
    update: {},
    create: { userId: author.id, provider: "CREDENTIALS", providerAccountId: author.email },
  });

  const publishedAt = new Date("2026-06-19T00:00:00.000Z");
  for (const g of SEED_GAMES) {
    const manifestKey = `games/${g.id}/1/manifest.json`;
    const coverUrl = publicUrl(`games/${g.id}/1/cover.svg`);
    await prisma.game.upsert({
      where: { id: g.id },
      update: { title: g.title, summary: g.summary, tags: g.tags, coverUrl, status: "PUBLISHED", publishedAt },
      create: {
        id: g.id,
        title: g.title,
        summary: g.summary,
        tags: g.tags,
        coverUrl,
        authorId: author.id,
        status: "PUBLISHED",
        publishedAt,
      },
    });
    const version = await prisma.version.upsert({
      where: { gameId_versionNumber: { gameId: g.id, versionNumber: 1 } },
      update: { runtime: "HTML5_CANVAS", manifestKey, manifestUrl: publicUrl(manifestKey), status: "PUBLISHED" },
      create: {
        gameId: g.id,
        versionNumber: 1,
        runtime: "HTML5_CANVAS",
        manifestKey,
        manifestUrl: publicUrl(manifestKey),
        status: "PUBLISHED",
      },
    });
    await prisma.game.update({ where: { id: g.id }, data: { activeVersionId: version.id } });
  }

  console.log(`[seed] author + ${SEED_GAMES.length} games upserted`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[seed] failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
