import type { AgentLogDTO, AgentName, LogLevel, TaskDTO, TaskStatus } from "./contracts/tasks";

/**
 * 纯 DTO 序列化（Prisma 行 → 边界 DTO）。无重依赖，供路由 + worker runner 共用，
 * 保证 GET /api/tasks/:id（轮询）与 SSE 中继对同一形状达成一致。
 */
type LogRow = {
  seq: number;
  agentName: AgentName;
  level: LogLevel;
  title: string;
  inputSummary: string | null;
  outputSummary: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  createdAt: Date;
};

export function toLogDTO(l: LogRow): AgentLogDTO {
  return {
    seq: l.seq,
    agentName: l.agentName,
    level: l.level,
    title: l.title,
    inputSummary: l.inputSummary,
    outputSummary: l.outputSummary,
    tokensIn: l.tokensIn,
    tokensOut: l.tokensOut,
    latencyMs: l.latencyMs,
    createdAt: l.createdAt.toISOString(),
  };
}

type TaskRow = {
  id: string;
  status: TaskStatus;
  currentStep: AgentName | null;
  prompt: string;
  inputAssetIds: string[];
  modelProvider: string | null;
  attempt: number;
  error: string | null;
  gameId: string | null;
  resultVersionId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export function toTaskDTO(t: TaskRow): TaskDTO {
  return {
    id: t.id,
    status: t.status,
    currentStep: t.currentStep,
    prompt: t.prompt,
    inputAssetIds: t.inputAssetIds,
    modelProvider: t.modelProvider,
    attempt: t.attempt,
    error: t.error,
    gameId: t.gameId,
    resultVersionId: t.resultVersionId,
    createdAt: t.createdAt.toISOString(),
    startedAt: t.startedAt ? t.startedAt.toISOString() : null,
    finishedAt: t.finishedAt ? t.finishedAt.toISOString() : null,
  };
}
