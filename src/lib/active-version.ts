import { getSeedGame } from "./seed-games";
import { getObjectText, objectExists, publicUrl } from "./storage";
import { Manifest } from "./contracts/manifest";
import { ActiveVersionResponse } from "./contracts/games";

/**
 * Resolve a game's active version by reading + Zod-validating its manifest from MinIO
 * SERVER-SIDE (storage.getObject → no browser CORS). Shared by the API route and the
 * Play page so both agree on the exact `entryUrl`/`manifestUrl` (the Source-badge anchor).
 */
export type ResolveError = "GAME_NOT_FOUND" | "MANIFEST_UNAVAILABLE" | "ENTRY_NOT_FOUND";
export type ResolveResult =
  | { ok: true; data: ActiveVersionResponse }
  | { ok: false; status: number; error: ResolveError; detail?: string };

export async function resolveActiveVersion(id: string): Promise<ResolveResult> {
  const game = getSeedGame(id);
  if (!game) return { ok: false, status: 404, error: "GAME_NOT_FOUND" };

  const manifestKey = `${game.prefix}/manifest.json`;
  let manifest: Manifest;
  try {
    manifest = Manifest.parse(JSON.parse(await getObjectText(manifestKey)));
  } catch (err) {
    return { ok: false, status: 502, error: "MANIFEST_UNAVAILABLE", detail: String(err) };
  }

  // MED-1: manifest 存在 ≠ 入口对象存在。HEAD 一下入口，缺失就走干净 failed
  // （否则浏览器对 404 也会触发 onload，被误判成 "Loaded" 盖在 MinIO NoSuchKey XML 上）。
  const entryKey = `${game.prefix}/${manifest.entry}`;
  if (!(await objectExists(entryKey))) {
    return { ok: false, status: 502, error: "ENTRY_NOT_FOUND", detail: entryKey };
  }

  const data = ActiveVersionResponse.parse({
    gameId: manifest.gameId,
    versionNumber: manifest.version,
    runtime: manifest.runtime,
    manifestUrl: publicUrl(manifestKey),
    entryUrl: publicUrl(entryKey),
  });
  return { ok: true, data };
}
