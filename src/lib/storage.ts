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

const credentials = {
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
};

/** In-network client — server-side object IO against `S3_ENDPOINT` (`minio:9000` in compose). */
export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials,
});

/**
 * Public-endpoint client — ONLY for presigning browser-facing URLs. The signed canonical
 * request includes the host header, so a URL signed against `minio:9000` would fail when the
 * browser PUTs/GETs to `localhost:9000`. Presign against the same host the browser will hit.
 */
const s3public = new S3Client({
  endpoint: env.S3_PUBLIC_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials,
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

/**
 * Short-lived presigned GET — browser-reachable read of a private `uploads/*` object
 * (e.g. Create's upload thumbnail). Signed against the PUBLIC endpoint. `games/*` is
 * public-read, so Play never needs this.
 */
export function presignGet(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(s3public, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

/**
 * Short-lived presigned PUT — the browser uploads multimodal assets DIRECTLY to MinIO
 * (never through the app, docs/07 §2). Presigned against the PUBLIC endpoint so the URL the
 * browser receives is actually reachable from the browser (dual-endpoint: the in-network
 * `minio:9000` host would 502 from a laptop). ContentType is bound into the signature.
 */
export function presignPut(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(
    s3public,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}
