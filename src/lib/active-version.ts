import { getSeedGame } from "./seed-games";
import { getObjectText, publicUrl } from "./storage";
import { Manifest } from "./contracts/manifest";
import { ActiveVersionResponse } from "./contracts/games";

/**
 * Resolve a game's active version by reading + Zod-validating its manifest from MinIO
 * SERVER-SIDE (storage.getObject → no browser CORS). Shared by the API route and the
 * Play page so both agree on the exact `entryUrl`/`manifestUrl` (the Source-badge anchor).
 */
export type ResolveResult =
  | { ok: true; data: ActiveVersionResponse }
  | { ok: false; status: number; error: string; detail?: string };

export async function resolveActiveVersion(id: string): Promise<ResolveResult> {
  const game = getSeedGame(id);
  if (!game) return { ok: false, status: 404, error: "GAME_NOT_FOUND" };

  const manifestKey = `${game.prefix}/manifest.json`;
  try {
    const manifest = Manifest.parse(JSON.parse(await getObjectText(manifestKey)));
    const data = ActiveVersionResponse.parse({
      gameId: manifest.gameId,
      versionNumber: manifest.version,
      runtime: manifest.runtime,
      manifestUrl: publicUrl(manifestKey),
      entryUrl: publicUrl(`${game.prefix}/${manifest.entry}`),
    });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, status: 502, error: "MANIFEST_UNAVAILABLE", detail: String(err) };
  }
}
