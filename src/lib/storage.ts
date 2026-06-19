/**
 * ★ THE ONLY FILE allowed to import `@aws-sdk/client-s3` / `fs` (CLAUDE.md Fatal #1).
 * eslint `no-restricted-imports` bans those everywhere else; this file is the override.
 * Every object-storage byte enters/leaves through here, against real MinIO (S3 protocol) —
 * no local-fs shim. Migrating to real S3 = change env only (endpoints/creds/path-style).
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

// Boot guard (dual-endpoint pitfall): the PUBLIC endpoint is what gets baked into Play URLs
// and handed to the browser. The compose service name `minio` only resolves inside the docker
// network, so it can never be correct for a browser — fail fast rather than ship dead iframe URLs.
if (env.S3_PUBLIC_ENDPOINT.includes("minio:")) {
  throw new Error(
    `S3_PUBLIC_ENDPOINT must be browser-reachable, got "${env.S3_PUBLIC_ENDPOINT}". ` +
      `Only S3_ENDPOINT may point at the "minio" service; the public endpoint should be e.g. http://localhost:9000.`,
  );
}

export const BUCKET = env.S3_BUCKET;

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

/**
 * Browser-facing absolute URL for an object — path-style, INCLUDING the bucket segment.
 * Always uses S3_PUBLIC_ENDPOINT (never S3_ENDPOINT). Example:
 *   publicUrl("games/neon-dodger/1/index.html")
 *   → http://localhost:9000/yahaha/games/neon-dodger/1/index.html
 */
export function publicUrl(key: string): string {
  const base = env.S3_PUBLIC_ENDPOINT.replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `${base}/${BUCKET}/${cleanKey}`;
}

/** Read an object's body as UTF-8 text (server-side; same-origin to MinIO, no CORS needed). */
export async function getObjectText(key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!res.Body) throw new Error(`Empty body for object ${key}`);
  return res.Body.transformToString("utf-8");
}

/** Write an object. Used by later checkpoints (packager); included now for completeness. */
export async function putObject(
  key: string,
  body: Uint8Array | string,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Short-lived presigned GET — for private `uploads/*`. `games/*` is public-read, so no signing. */
export function presignGet(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}
