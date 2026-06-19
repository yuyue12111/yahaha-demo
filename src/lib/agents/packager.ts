import { createHash } from "node:crypto";
import { prisma } from "../db";
import { putObject, publicUrl } from "../storage";
import { wireToDb } from "../contracts/runtime";
import { Manifest, MANIFEST_SCHEMA_VERSION } from "../contracts/manifest";
import { BUNDLE_CSP } from "./coder";
import type {
  AgentContext,
  CoderOutput,
  GameSpec,
  NodeResult,
  PackageResult,
  ValidationResult,
} from "./types";
import { PackageResult as PackageResultSchema } from "./types";

const RUNTIME_WIRE = "html5-canvas" as const;

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function deriveTags(spec: GameSpec): string[] {
  const raw = [spec.genre, spec.engine?.mode ?? "", "neon"].map((t) => t.toLowerCase().trim());
  return [...new Set(raw.filter(Boolean))].slice(0, 5);
}

/**
 * PACKAGER —— 算哈希、组 manifest、上传 MinIO 版本化路径、写 Game(DRAFT)+Version(PREVIEW)。
 * 产物字节先**全量**写 MinIO，再写 Version 行（docs/08：避免半写）。manifest 写时过 Zod 校验。
 * 首次生成创建 Game（DRAFT，未发布）；产物可经 done 事件 entryUrl 直接预览，无需先发布（CP4 才发布）。
 */
export async function runPackager(
  ctx: AgentContext,
  spec: GameSpec,
  coder: CoderOutput,
  _validation: ValidationResult,
): Promise<NodeResult<PackageResult>> {
  // 1) 确定 gameId + versionNumber（首次建 Game；regen 复用并 +1）。
  let gameId = ctx.gameId;
  let versionNumber = 1;
  if (gameId) {
    const last = await prisma.version.findFirst({
      where: { gameId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    versionNumber = (last?.versionNumber ?? 0) + 1;
  } else {
    const game = await prisma.game.create({
      data: {
        title: spec.title,
        summary: spec.summary,
        tags: deriveTags(spec),
        authorId: ctx.userId,
        status: "DRAFT",
      },
      select: { id: true },
    });
    gameId = game.id;
  }

  const prefix = `games/${gameId}/${versionNumber}`;

  // 2) 算每文件 sha256 + 全量上传 MinIO（先产物后 Version 行）。
  const manifestFiles = coder.files.map((f) => ({
    path: f.path,
    contentType: f.contentType,
    bytes: Buffer.byteLength(f.content, "utf8"),
    sha256: sha256(f.content),
  }));
  for (const f of coder.files) {
    await putObject(`${prefix}/${f.path}`, f.content, f.contentType);
  }

  // 3) 组 + 校验 manifest（写时 Zod，docs/05）。
  const bundleSha256 = sha256(manifestFiles.map((f) => f.sha256).join(""));
  const manifestKey = `${prefix}/manifest.json`;
  const manifest = Manifest.parse({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    gameId,
    version: versionNumber,
    title: spec.title,
    summary: spec.summary,
    runtime: RUNTIME_WIRE,
    entry: "index.html",
    controls: spec.controls,
    files: manifestFiles,
    assets: [],
    postMessageContract: {
      version: 1,
      ready: "GAME_LOADED",
      score: "GAME_SCORE",
      ended: "GAME_ENDED",
      error: "GAME_ERROR",
    },
    csp: BUNDLE_CSP,
    createdBy: ctx.userId,
    createdAt: new Date().toISOString(),
    integrity: { bundleSha256 },
  });
  await putObject(manifestKey, JSON.stringify(manifest, null, 2), "application/json");

  const manifestUrl = publicUrl(manifestKey);
  const entryUrl = publicUrl(`${prefix}/index.html`);
  const coverUrl = publicUrl(`${prefix}/cover.svg`);

  // 4) 写 Version(PREVIEW, createdByTaskId) + 回填 Game.coverUrl。
  const version = await prisma.version.create({
    data: {
      gameId,
      versionNumber,
      runtime: wireToDb(RUNTIME_WIRE), // MED-5：wire → DB 符号
      manifestKey,
      manifestUrl,
      status: "PREVIEW",
      createdByTaskId: ctx.taskId,
    },
    select: { id: true },
  });
  await prisma.game.update({ where: { id: gameId }, data: { coverUrl } });

  const output = PackageResultSchema.parse({
    gameId,
    versionId: version.id,
    versionNumber,
    runtime: RUNTIME_WIRE,
    manifestKey,
    manifestUrl,
    entryUrl,
    coverUrl,
  });
  return {
    output,
    inputSummary: `${coder.files.length} 文件 → ${prefix}/`,
    outputSummary: `Version#${versionNumber}(PREVIEW) · ${manifestFiles.length} 文件上传 · bundleSha ${bundleSha256.slice(0, 12)}…`,
  };
}
