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
