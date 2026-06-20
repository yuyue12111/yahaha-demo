import { prisma } from "./db";
import { getObjectText, objectExists, publicUrl } from "./storage";
import { Manifest } from "./contracts/manifest";
import { ActiveVersionResponse } from "./contracts/games";

/**
 * 解析游戏的 active version（DB-backed，CP2）：Game→activeVersion→manifestKey，
 * 再服务端读+Zod 校验 manifest（无 CORS）。Play 页与 API route 共用，二者对同一 entryUrl/manifestUrl 达成一致（Source 徽章锚点）。
 * 只把「id→manifestKey 查找」移到 DB；URL 构造与 iframe seam 不变（§5 保留）。
 */
export type ResolveError = "GAME_NOT_FOUND" | "MANIFEST_UNAVAILABLE" | "ENTRY_NOT_FOUND";
export type ResolveResult =
  | { ok: true; data: ActiveVersionResponse }
  | { ok: false; status: number; error: ResolveError; detail?: string };

export async function resolveActiveVersion(id: string): Promise<ResolveResult> {
  const game = await prisma.game.findUnique({
    where: { id },
    include: { activeVersion: true },
  });
  if (!game || !game.activeVersion) {
    return { ok: false, status: 404, error: "GAME_NOT_FOUND" };
  }

  const manifestKey = game.activeVersion.manifestKey;
  let manifest: Manifest;
  try {
    manifest = Manifest.parse(JSON.parse(await getObjectText(manifestKey)));
  } catch (err) {
    return { ok: false, status: 502, error: "MANIFEST_UNAVAILABLE", detail: String(err) };
  }

  // MED-1：manifest 存在 ≠ 入口对象存在。entryKey 从 manifestKey 的前缀推（单一来源），HEAD 校验。
  const prefix = manifestKey.replace(/\/[^/]*$/, "");
  const entryKey = `${prefix}/${manifest.entry}`;
  if (!(await objectExists(entryKey))) {
    return { ok: false, status: 502, error: "ENTRY_NOT_FOUND", detail: entryKey };
  }

  const data = ActiveVersionResponse.parse({
    gameId: manifest.gameId,
    versionNumber: manifest.version,
    runtime: manifest.runtime, // wire 值（保 MED-5：不读 DB 枚举符号）
    manifestUrl: publicUrl(manifestKey),
    entryUrl: publicUrl(entryKey),
    controls: manifest.controls, // T1：玩法提示透传给 Play/详情
  });
  return { ok: true, data };
}
