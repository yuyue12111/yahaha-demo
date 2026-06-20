import { z } from "zod";
import { RuntimeKind } from "./manifest";

/** Response of GET /api/games/:id/active-version (docs/03 + docs/05 §Play 解析顺序 step 1). */
export const ActiveVersionResponse = z.object({
  gameId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  runtime: RuntimeKind,
  manifestUrl: z.string().url(),
  entryUrl: z.string().url(),
  // T1：玩法提示从 manifest 透传到 Play/详情，让玩家看到键位（数据本就在 manifest.controls）。
  controls: z.string().default(""),
});
export type ActiveVersionResponse = z.infer<typeof ActiveVersionResponse>;

/** Home 卡片（docs/03 GameCard）。coverUrl/publishedAt 可空（docs/02）。 */
export const GameCard = z.object({
  id: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  coverUrl: z.string().url().nullable(),
  tags: z.array(z.string()),
  author: z.object({ id: z.string(), displayName: z.string() }),
  publishedAt: z.string().nullable(),
  playCount: z.number().int().nonnegative(),
});
export type GameCard = z.infer<typeof GameCard>;

/** GET /api/games 响应（docs/03：分页信封）。 */
export const GamesListResponse = z.object({
  items: z.array(GameCard),
  nextCursor: z.string().optional(),
});
export type GamesListResponse = z.infer<typeof GamesListResponse>;

/**
 * GET /api/games/:id 响应（docs/03:31）。游戏 meta + 作者 + 活跃版本摘要 + 统计。
 * `liked/favorited` 为可选（like/favorite 仍 deferred，故缺省不返回）。
 * activeVersion 取自 DB 关系（轻量，不做 MinIO HEAD）；Play 解析仍走 active-version 端点。
 */
export const GameDetail = z.object({
  game: z.object({
    id: z.string().min(1),
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
    coverUrl: z.string().url().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    publishedAt: z.string().nullable(),
    createdAt: z.string(),
  }),
  author: z.object({ id: z.string(), displayName: z.string() }),
  activeVersion: z
    .object({
      id: z.string(),
      versionNumber: z.number().int().positive(),
      runtime: RuntimeKind,
    })
    .nullable(),
  stats: z.object({
    likes: z.number().int().nonnegative(),
    favorites: z.number().int().nonnegative(),
    playCount: z.number().int().nonnegative(),
  }),
  liked: z.boolean().optional(),
  favorited: z.boolean().optional(),
});
export type GameDetail = z.infer<typeof GameDetail>;

/** PATCH /api/games/:id（作者改 meta，T2-1）。至少一个字段。 */
export const GameUpdateRequest = z
  .object({
    title: z.string().trim().min(1, "标题不能为空").max(80).optional(),
    summary: z.string().trim().max(500).optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  })
  .refine((d) => d.title !== undefined || d.summary !== undefined || d.tags !== undefined, {
    message: "至少修改一个字段",
  });
export type GameUpdateRequest = z.infer<typeof GameUpdateRequest>;

/** POST /api/games/:id/archive（作者下架/恢复，T2-1）。 */
export const GameArchiveRequest = z.object({ archived: z.boolean() });
export type GameArchiveRequest = z.infer<typeof GameArchiveRequest>;
