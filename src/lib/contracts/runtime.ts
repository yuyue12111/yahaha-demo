import { z } from "zod";

/**
 * RuntimeKind 单一真源 — 权威映射见 docs/02-data-model.md。
 * - **wire / manifest 值**：小写连字符（`html5-canvas`）—— 用于 manifest、API、postMessage、本地 seed。
 * - **DB / Prisma 符号**：大写下划线（`HTML5_CANVAS`），经 Prisma `@map("html5-canvas")` 落库为 wire 值。
 *
 * 接 Prisma（D1-PM）时，DB 符号 ⇄ wire 值之间用下面的 map 转换，避免反序列化撞名（MED-5）。
 */
export const RUNTIME_KINDS = ["html5-canvas", "phaser3"] as const;
export const RuntimeKind = z.enum(RUNTIME_KINDS);
export type RuntimeKind = z.infer<typeof RuntimeKind>;

/** Prisma 枚举符号 → wire 值（与未来 `@map(...)` 一致）。 */
export const RUNTIME_DB_TO_WIRE = {
  HTML5_CANVAS: "html5-canvas",
  PHASER3: "phaser3",
} as const satisfies Record<string, RuntimeKind>;
export type RuntimeDbSymbol = keyof typeof RUNTIME_DB_TO_WIRE;

/** wire 值 → Prisma 枚举符号。 */
export const RUNTIME_WIRE_TO_DB = {
  "html5-canvas": "HTML5_CANVAS",
  phaser3: "PHASER3",
} as const satisfies Record<RuntimeKind, RuntimeDbSymbol>;

export const dbToWire = (s: RuntimeDbSymbol): RuntimeKind => RUNTIME_DB_TO_WIRE[s];
export const wireToDb = (w: RuntimeKind): RuntimeDbSymbol => RUNTIME_WIRE_TO_DB[w];
