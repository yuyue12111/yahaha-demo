import { z } from "zod";
import type { ModelClient } from "../model";
import type { AgentName, LogLevel } from "../contracts/tasks";

/**
 * Agent 工作流的类型化 IO（docs/04）。每节点输出用 Zod 校验 —— 这是"多步非黑盒"的契约证据，
 * 也是规避红线④的结构层（不是一次 LLM 调用外包几行假日志）。
 */

// ---- INGEST ----
export const AssetRef = z.object({
  assetId: z.string(),
  key: z.string(),
  contentType: z.string(),
});
export type AssetRef = z.infer<typeof AssetRef>;

export const AssetDescription = z.object({
  assetId: z.string(),
  description: z.string(),
});
export const IngestOutput = z.object({
  brief: z.string().min(1),
  assetDescriptions: z.array(AssetDescription).default([]),
});
export type IngestOutput = z.infer<typeof IngestOutput>;

// ---- PLANNER (GameSpec, docs/04 §GameSpec) ----
export const GameSpecAsset = z.object({
  id: z.string().min(1),
  role: z.enum(["sprite", "background", "sfx"]),
  description: z.string(),
});

/** 引擎调参（docs/04 GameSpec.engine）：CODER 内联进 game.js，使产物随输入变化。 */
export const EngineTuning = z.object({
  mode: z.enum(["dodge", "catch", "reaction"]),
  bg: z.string(),
  grid: z.string(),
  speed: z.number(),
  accel: z.number(),
  spawnMs: z.number(),
  misses: z.number().int().positive(),
});
export type EngineTuning = z.infer<typeof EngineTuning>;

export const GameSpec = z.object({
  title: z.string().min(1),
  genre: z.string().min(1),
  summary: z.string().min(1),
  mechanics: z.array(z.string()).min(1),
  controls: z.string().min(1),
  winCondition: z.string().min(1),
  loseCondition: z.string().min(1),
  theme: z.string().min(1),
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1),
  requiredAssets: z.array(GameSpecAsset).default([]),
  engine: EngineTuning.optional(),
});
export type GameSpec = z.infer<typeof GameSpec>;

// ---- ASSET_CURATOR ----
export const AssetPlan = z.object({
  mappings: z.array(z.object({ assetId: z.string(), role: z.string(), s3Key: z.string() })).default([]),
  placeholders: z
    .array(z.object({ id: z.string(), role: z.string(), note: z.string() }))
    .default([]),
});
export type AssetPlan = z.infer<typeof AssetPlan>;

// ---- CODER ----
export const CoderFile = z.object({
  path: z.string().min(1),
  content: z.string(),
  contentType: z.string().min(1),
});
export const CoderOutput = z.object({
  files: z.array(CoderFile).min(1),
});
export type CoderOutput = z.infer<typeof CoderOutput>;
export type CoderFile = z.infer<typeof CoderFile>;

// ---- VALIDATOR ----
export const ValidationResult = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()).default([]),
  coverPath: z.string().optional(),
  bundleBytes: z.number().int().nonnegative(),
});
export type ValidationResult = z.infer<typeof ValidationResult>;

// ---- PACKAGER ----
export const PackageResult = z.object({
  gameId: z.string(),
  versionId: z.string(),
  versionNumber: z.number().int().positive(),
  runtime: z.string(),
  manifestKey: z.string(),
  manifestUrl: z.string().url(),
  entryUrl: z.string().url(),
  coverUrl: z.string().url(),
});
export type PackageResult = z.infer<typeof PackageResult>;

/**
 * 节点运行上下文 —— runner 注入，贯穿全链。`emit` 写 AgentLog(seq) + 发 SSE step/log。
 */
export type EmitArgs = {
  agent: AgentName;
  title: string;
  inputSummary?: string;
  outputSummary?: string;
  level?: LogLevel;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
};

export type AgentContext = {
  taskId: string;
  userId: string;
  gameId: string | null;
  prompt: string;
  assetIds: string[];
  seedKey: string;
  model: ModelClient;
  /** 'refine' = 自然语言微调：基于 refineCode 定向编辑（prompt 为指令）。默认 'create'。 */
  mode: "create" | "refine";
  /** refine 模式下载入的现有 game.js 源码（供 CODER 编辑）；create 模式为 null。 */
  refineCode: string | null;
};

/**
 * 节点返回：纯逻辑产物 + 给 runner 写 AgentLog 的 IO 摘要/tokens。
 * runner 负责 seq/计时/SSE/落库；节点只管"做什么 + 摘要是什么"。
 */
export type NodeResult<T> = {
  output: T;
  inputSummary: string;
  outputSummary: string;
  tokensIn?: number;
  tokensOut?: number;
};
