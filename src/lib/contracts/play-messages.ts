import { z } from "zod";

/** postMessage protocol v1 — docs/06-play-runtime-contract.md. Host validates the envelope. */
export const GAME_MESSAGE_SOURCE = "yahaha-game" as const;
export const HOST_MESSAGE_SOURCE = "yahaha-host" as const;
export const PLAY_PROTOCOL_VERSION = 1 as const;

const envelope = {
  source: z.literal(GAME_MESSAGE_SOURCE),
  v: z.literal(PLAY_PROTOCOL_VERSION),
};

/**
 * game → host messages, fully enveloped. Filter on `source` + `v` (and event.source identity)
 * BEFORE switching on `type`. A sandboxed (null-origin) frame is untrusted; never trust origin.
 */
export const GameMessage = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("GAME_LOADED") }),
  z.object({ ...envelope, type: z.literal("GAME_SCORE"), payload: z.object({ score: z.number() }) }),
  z.object({
    ...envelope,
    type: z.literal("GAME_ENDED"),
    payload: z.object({ score: z.number().optional() }).optional(),
  }),
  z.object({ ...envelope, type: z.literal("GAME_ERROR"), payload: z.object({ message: z.string() }) }),
]);
export type GameMessage = z.infer<typeof GameMessage>;

/** host → game messages. Sent with targetOrigin "*" (can't name a null/opaque origin). */
export type HostToGameType = "HOST_INIT" | "HOST_RESTART";
export function hostMessage(type: HostToGameType, config?: unknown) {
  return { source: HOST_MESSAGE_SOURCE, v: PLAY_PROTOCOL_VERSION, type, payload: config };
}
