import { z } from "zod";

/** POST /api/games/:id/publish（docs/03:33 + docs/05 §版本与发布）。 */
export const PublishRequest = z.object({
  versionId: z.string().min(1),
});
export type PublishRequest = z.infer<typeof PublishRequest>;

export const PublishResponse = z.object({
  gameId: z.string().min(1),
  status: z.literal("PUBLISHED"),
  activeVersionId: z.string().min(1),
  publishedAt: z.string(),
});
export type PublishResponse = z.infer<typeof PublishResponse>;
