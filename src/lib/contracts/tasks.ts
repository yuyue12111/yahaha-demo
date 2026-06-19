import { z } from "zod";
import { RuntimeKind } from "./runtime";

/**
 * 生成任务 + Agent 工作流的边界契约（docs/03 §Tasks + §SSE，docs/04 节点链）。
 * 这些枚举与 Prisma `TaskStatus`/`AgentName`/`LogLevel` 同名（无 @map → wire 值 == DB 符号），
 * 故 DB 行可直接序列化进这些 DTO，无需映射。
 */
export const TASK_STATUSES = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"] as const;
export const TaskStatus = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatus>;

// 6 节点链（docs/04）；最小回退 3 节点是 PLANNER→CODER→VALIDATOR。
export const AGENT_NAMES = [
  "INGEST",
  "PLANNER",
  "ASSET_CURATOR",
  "CODER",
  "VALIDATOR",
  "PACKAGER",
] as const;
export const AgentName = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof AgentName>;

export const LOG_LEVELS = ["INFO", "WARN", "ERROR"] as const;
export const LogLevel = z.enum(LOG_LEVELS);
export type LogLevel = z.infer<typeof LogLevel>;

/** POST /api/tasks 请求体。prompt 必填；其余可选（gameId/remix 留 CP3+）。 */
export const CreateTaskRequest = z.object({
  prompt: z.string().trim().min(1, "prompt 不能为空").max(2000),
  assetIds: z.array(z.string().min(1)).max(8).optional(),
  gameId: z.string().min(1).optional(),
  remixOfVersionId: z.string().min(1).optional(),
});
export type CreateTaskRequest = z.infer<typeof CreateTaskRequest>;

/** POST /api/tasks 响应（202，写库+enqueue 后立即返回，绝不阻塞跑模型）。 */
export const CreateTaskResponse = z.object({
  taskId: z.string().min(1),
  status: z.literal("PENDING"),
});
export type CreateTaskResponse = z.infer<typeof CreateTaskResponse>;

/** 单条 AgentLog（证明多步非黑盒；docs/02 §AgentLog + docs/08）。 */
export const AgentLogDTO = z.object({
  seq: z.number().int().nonnegative(),
  agentName: AgentName,
  level: LogLevel,
  title: z.string(),
  inputSummary: z.string().nullable(),
  outputSummary: z.string().nullable(),
  tokensIn: z.number().int().nullable(),
  tokensOut: z.number().int().nullable(),
  latencyMs: z.number().int().nullable(),
  createdAt: z.string(),
});
export type AgentLogDTO = z.infer<typeof AgentLogDTO>;

/** GET /api/tasks/:id 的 task 字段（轮询兜底，可随时重建 UI 状态）。 */
export const TaskDTO = z.object({
  id: z.string(),
  status: TaskStatus,
  currentStep: AgentName.nullable(),
  prompt: z.string(),
  inputAssetIds: z.array(z.string()),
  modelProvider: z.string().nullable(),
  attempt: z.number().int(),
  error: z.string().nullable(),
  gameId: z.string().nullable(),
  resultVersionId: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type TaskDTO = z.infer<typeof TaskDTO>;

export const TaskDetailResponse = z.object({
  task: TaskDTO,
  logs: z.array(AgentLogDTO),
});
export type TaskDetailResponse = z.infer<typeof TaskDetailResponse>;

/**
 * 终态 `done` 事件载荷。docs/03 列了 status/versionId/manifestUrl/error；
 * 这里**额外**带 gameId/versionNumber/runtime/entryUrl，使 Create 预览能直接复用 PlayShell
 * （无需先发布、无需 activeVersion）。docs/03 §SSE done 已回填这些字段。
 */
export const TaskDoneData = z.object({
  status: z.enum(["SUCCEEDED", "FAILED"]),
  versionId: z.string().optional(),
  gameId: z.string().optional(),
  versionNumber: z.number().int().positive().optional(),
  runtime: RuntimeKind.optional(),
  manifestUrl: z.string().url().optional(),
  entryUrl: z.string().url().optional(),
  error: z.string().optional(),
});
export type TaskDoneData = z.infer<typeof TaskDoneData>;

/**
 * worker → Redis pub/sub → SSE 中继的事件信封（docs/03 §SSE 事件契约）。
 * 在 `event` 上判别；SSE 端按 `event` 名 + JSON `data` 写 `text/event-stream`。
 */
export const TaskEvent = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("status"),
    data: z.object({ status: TaskStatus, currentStep: AgentName.nullish() }),
  }),
  z.object({
    event: z.literal("step"),
    data: z.object({
      agentName: AgentName,
      seq: z.number().int().nonnegative(),
      title: z.string(),
      state: z.enum(["start", "end"]),
      level: LogLevel,
    }),
  }),
  z.object({ event: z.literal("log"), data: AgentLogDTO }),
  z.object({ event: z.literal("done"), data: TaskDoneData }),
]);
export type TaskEvent = z.infer<typeof TaskEvent>;
