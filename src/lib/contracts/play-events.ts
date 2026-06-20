import { z } from "zod";

/**
 * POST /api/play-events（docs/06 §postMessage + docs/08 §可观测）—— Play 运行时埋点。
 * PlayShell 收到游戏的 postMessage 生命周期后回写：LOAD（→ playCount++）/ END / ERROR。
 * 公开端点（游玩无需登录）；userId 若有 session 则附带（PlayEvent.userId 无 FK，stale 也安全）。
 */
export const PLAY_EVENT_TYPES = ["LOAD", "START", "END", "ERROR"] as const;
export const PlayEventType = z.enum(PLAY_EVENT_TYPES);
export type PlayEventType = z.infer<typeof PlayEventType>;

export const PlayEventRequest = z.object({
  gameId: z.string().min(1),
  versionId: z.string().min(1).optional(),
  type: PlayEventType,
  score: z.number().int().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});
export type PlayEventRequest = z.infer<typeof PlayEventRequest>;

export const PlayEventResponse = z.object({
  ok: z.literal(true),
  playCount: z.number().int().nonnegative().optional(),
});
export type PlayEventResponse = z.infer<typeof PlayEventResponse>;
