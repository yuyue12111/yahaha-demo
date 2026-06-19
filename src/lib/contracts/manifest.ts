import { z } from "zod";
import { RuntimeKind, RUNTIME_KINDS } from "./runtime";

// RuntimeKind 的单一真源在 ./runtime（含 DB⇄wire 映射，MED-5）；这里 re-export 保持既有 import 路径可用。
export { RuntimeKind, RUNTIME_KINDS };

/** Remote artifact manifest — docs/05-remote-artifact-protocol.md. Validated on write AND read. */
export const MANIFEST_SCHEMA_VERSION = 1 as const;

/**
 * A relative, prefix-local artifact path. These get concatenated into MinIO keys / the iframe
 * src + Source badge, so the read-side validator forbids leading "/", ".." traversal, and URL
 * schemes — a defense-in-depth guard for when manifests are machine-generated (CP2+).
 */
const relPath = z
  .string()
  .min(1)
  .refine(
    (p) =>
      !p.startsWith("/") &&
      !p.startsWith("./") &&
      !p.includes("..") &&
      !/^[a-zA-Z][\w+.-]*:/.test(p),
    { message: "must be a relative, prefix-local path (no leading '/' or './', no '..', no URL scheme)" },
  );

export const ManifestFile = z.object({
  path: relPath,
  contentType: z.string().min(1),
  bytes: z.number().int().nonnegative().optional(),
  sha256: z.string().optional(),
});

export const ManifestAsset = z.object({
  id: z.string().min(1),
  path: relPath,
  contentType: z.string().min(1),
  sourceUpload: z.string().optional(),
});

export const PostMessageContract = z.object({
  version: z.literal(1),
  ready: z.literal("GAME_LOADED"),
  score: z.literal("GAME_SCORE"),
  ended: z.literal("GAME_ENDED"),
  error: z.literal("GAME_ERROR"),
});

export const Manifest = z.object({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  // CP1 seed ids are readable strings (e.g. "neon-dodger"); DB-backed games tighten to cuid later.
  gameId: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().default(""),
  runtime: RuntimeKind,
  entry: relPath,
  controls: z.string().default(""),
  files: z.array(ManifestFile).min(1),
  assets: z.array(ManifestAsset).default([]),
  postMessageContract: PostMessageContract,
  csp: z.string().min(1),
  createdBy: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  integrity: z.object({ bundleSha256: z.string().optional() }).optional(),
});
export type Manifest = z.infer<typeof Manifest>;
