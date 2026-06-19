import type { RuntimeKind } from "./contracts/manifest";

/**
 * CP1 static registry — stand-in for the DB-backed `Game`/`Version` lookup arriving in D1-PM.
 * The same `resolveActiveVersion()` contract is served either way; only the source swaps.
 * The id MUST match the on-MinIO prefix and the manifest `gameId` (3-way consistency).
 */
export type SeedGame = {
  id: string;
  versionNumber: number;
  runtime: RuntimeKind;
  /** object-store prefix, no trailing slash — e.g. "games/neon-dodger/1" */
  prefix: string;
};

export const SEED_GAMES: Record<string, SeedGame> = {
  "neon-dodger": {
    id: "neon-dodger",
    versionNumber: 1,
    runtime: "html5-canvas",
    prefix: "games/neon-dodger/1",
  },
};

export function getSeedGame(id: string): SeedGame | undefined {
  return SEED_GAMES[id];
}
