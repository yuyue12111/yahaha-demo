import type { ZodTypeAny } from "zod";

/**
 * 模型 seam（docs/04 §模型 seam）。可插拔实现：mock | openai(codex) | anthropic。
 * 关键约束：**mock 必须确定性且输入敏感** —— 用 hash(prompt+assetIds) 做种，同输入同输出、
 * 异输入异输出（规避红线③固定假数据）。所有实现都流经全部节点、产真实可玩 bundle、写真实日志。
 */
export type Msg = { role: "system" | "user" | "assistant"; content: string };

export type ChatInput = {
  system?: string;
  messages: Msg[];
  /** 提供 schema → 返回 schema 校验后的结构化对象（JSON mode / 节点内修复重试）。 */
  schema?: ZodTypeAny;
  /** 确定性种子源（= prompt + assetIds）。mock 据此播种；真实模型忽略。 */
  seedKey?: string;
};

export type ChatResult<T = unknown> = {
  text?: string;
  object?: T;
  tokensIn: number;
  tokensOut: number;
};

export type VisionInput = {
  imageUrl?: string;
  imageBytes?: Uint8Array;
  prompt: string;
  /** mock 用：上传文件的可读提示（文件名/MIME），让描述随上传变化。 */
  hint?: string;
  seedKey?: string;
};

export type VisionResult = {
  text: string;
  tokensIn: number;
  tokensOut: number;
};

export interface ModelClient {
  /** 实际 provider 名（写入 GenerationTask.modelProvider，可观测）。 */
  readonly provider: string;
  chat<T = unknown>(input: ChatInput): Promise<ChatResult<T>>;
  vision(input: VisionInput): Promise<VisionResult>;
}
