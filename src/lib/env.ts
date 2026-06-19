import { z } from "zod";

/**
 * Server-side env contract (single source of truth for storage config).
 * Defaults mirror `.env.example` so local dev + the mock path run with no `.env`.
 * NOTE the dual endpoint: S3_ENDPOINT is the in-network host the Node SDK talks to
 * (`http://minio:9000` in compose); S3_PUBLIC_ENDPOINT is the browser-reachable host
 * baked into Play URLs (`http://localhost:9000`). They differ on purpose.
 */
const EnvSchema = z.object({
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_PUBLIC_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  S3_BUCKET: z.string().min(1).default("yahaha"),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export const env = EnvSchema.parse({
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_PUBLIC_ENDPOINT: process.env.S3_PUBLIC_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
});
