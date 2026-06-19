import { z } from "zod";
import { RuntimeKind } from "./manifest";

/** Response of GET /api/games/:id/active-version (docs/03 + docs/05 §Play 解析顺序 step 1). */
export const ActiveVersionResponse = z.object({
  gameId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  runtime: RuntimeKind,
  manifestUrl: z.string().url(),
  entryUrl: z.string().url(),
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
