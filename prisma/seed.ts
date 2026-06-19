import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { runGeneration } from "../src/lib/agents/runner";
import { publishGameVersion } from "../src/lib/publish";

/**
 * 幂等 seed（compose 一次性 `seed` 服务，`tsx prisma/seed.ts`）：
 *  1) 作者 + CREDENTIALS account；
 *  2) 2 个手作预制游戏（bundle 由 minio-init 上传）；
 *  3) **真跑一次 Create 流水线**（确定性 mock）产出第 3 个游戏并发布 → 满足「≥3 游戏，≥1 来自 Create」（docs/00:62）。
 * 共用 app 的 `prisma`/`runGeneration`/`publishGameVersion`，与运行期同一套代码路径（非另写假数据）。
 */
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

const SEED_CREATE_PROMPT = "一个霓虹太空主题的躲避小游戏，节奏随时间加快，适合快速上手";

/** 真跑一次生成流水线 + 发布 → 一个「来自 Create 流程」的已发布游戏。幂等：已有则跳过。 */
async function seedCreateGame(authorId: string): Promise<void> {
  const prior = await prisma.generationTask.findFirst({
    where: { prompt: SEED_CREATE_PROMPT, status: "SUCCEEDED", gameId: { not: null } },
    select: { gameId: true },
    orderBy: { createdAt: "desc" },
  });
  if (prior?.gameId) {
    const g = await prisma.game.findUnique({ where: { id: prior.gameId }, select: { status: true } });
    if (g?.status === "PUBLISHED") {
      console.log("[seed] Create game already generated + published — skip");
      return;
    }
  }

  console.log("[seed] running the REAL Create pipeline once (deterministic mock)…");
  const task = await prisma.generationTask.create({
    data: { userId: authorId, prompt: SEED_CREATE_PROMPT, inputAssetIds: [], status: "PENDING" },
    select: { id: true },
  });
  await runGeneration(task.id); // 6 节点 → 真 bundle 上传 MinIO + Game(DRAFT)+Version(PREVIEW)
  const done = await prisma.generationTask.findUnique({
    where: { id: task.id },
    select: { status: true, gameId: true, resultVersionId: true, error: true },
  });
  if (done?.status !== "SUCCEEDED" || !done.gameId || !done.resultVersionId) {
    throw new Error(`Create pipeline failed: ${done?.error ?? "unknown"}`);
  }
  const pub = await publishGameVersion({
    gameId: done.gameId,
    versionId: done.resultVersionId,
    userId: authorId,
  });
  if (!pub.ok) throw new Error(`publish failed: ${pub.error}`); // 守卫：发布失败硬失败，防 <3 已发布回归
  console.log(`[seed] Create game generated + published: ${done.gameId}`);
}

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

  await seedCreateGame(author.id);

  const published = await prisma.game.count({ where: { status: "PUBLISHED" } });
  console.log(`[seed] done — ${SEED_GAMES.length} hand-authored + 1 Create = ${published} published games`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0); // 显式退出：runGeneration 的 redis 发布连接会挂住事件循环
  })
  .catch(async (e) => {
    console.error("[seed] failed:", e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
