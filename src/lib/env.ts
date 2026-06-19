import { z } from "zod";

/**
 * Server-side env contract (single source of truth for storage config).
 * Defaults mirror `.env.example` so local dev + the mock path run with no `.env`.
 * NOTE the dual endpoint: S3_ENDPOINT is the in-network host the Node SDK talks to
 * (`http://minio:9000` in compose); S3_PUBLIC_ENDPOINT is the browser-reachable host
 * baked into Play URLs (`http://localhost:9000`). They differ on purpose.
 */
/** Coerce a possibly-undefined env string to a positive int, falling back to `def`. */
const intDefault = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : def))
    .pipe(z.number().int().positive());

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

  // ---- 队列 (Redis / BullMQ) ----
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  // ---- 模型 seam (docs/04) ----
  // 缺省/无 key → mock，保证无密钥也能离线复现整条流水线（Fatal #3/#5）。
  MODEL_PROVIDER: z.enum(["codex", "openai", "anthropic", "mock"]).default("mock"),
  MODEL_BASE_URL: z.string().optional().default(""),
  MODEL_API_KEY: z.string().optional().default(""),
  MODEL_NAME: z.string().min(1).default("gpt-5.5"),
  VISION_MODEL_NAME: z.string().optional().default(""),

  // ---- 资源限额 / 安全阈值 (docs/07 §5) ----
  MAX_UPLOAD_BYTES: intDefault(10_485_760), // 10MB
  GENERATION_TIMEOUT_MS: intDefault(180_000),
  MAX_AGENT_RETRIES: intDefault(2),
  MAX_BUNDLE_BYTES: intDefault(2_097_152), // 2MB
  WORKER_CONCURRENCY: intDefault(2),
});

export const env = EnvSchema.parse({
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_PUBLIC_ENDPOINT: process.env.S3_PUBLIC_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,

  REDIS_URL: process.env.REDIS_URL,
  MODEL_PROVIDER: process.env.MODEL_PROVIDER,
  MODEL_BASE_URL: process.env.MODEL_BASE_URL,
  MODEL_API_KEY: process.env.MODEL_API_KEY,
  MODEL_NAME: process.env.MODEL_NAME,
  VISION_MODEL_NAME: process.env.VISION_MODEL_NAME,

  MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
  GENERATION_TIMEOUT_MS: process.env.GENERATION_TIMEOUT_MS,
  MAX_AGENT_RETRIES: process.env.MAX_AGENT_RETRIES,
  MAX_BUNDLE_BYTES: process.env.MAX_BUNDLE_BYTES,
  WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,
});
