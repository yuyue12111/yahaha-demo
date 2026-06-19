import { env } from "../env";
import type { ModelClient } from "./types";
import { MockModelClient } from "./mock";
import { OpenAICompatibleClient } from "./openai";

export type { ModelClient, ChatInput, ChatResult, VisionInput, VisionResult, Msg } from "./types";

/**
 * 据 env.MODEL_PROVIDER 选模型实现（docs/04 §模型 seam）。
 * **默认/缺 key → mock**：无密钥也能离线复现整条流水线（Fatal #3/#5）。
 * 真实 provider（codex/openai）需同时配齐 MODEL_BASE_URL + MODEL_API_KEY，否则回退 mock 并告警。
 */
export function getModelClient(): ModelClient {
  const provider = env.MODEL_PROVIDER;

  if (provider === "mock") return new MockModelClient();

  if (provider === "codex" || provider === "openai") {
    if (env.MODEL_BASE_URL && env.MODEL_API_KEY) {
      return new OpenAICompatibleClient(provider);
    }
    console.warn(
      `[model] MODEL_PROVIDER=${provider} 但缺 MODEL_BASE_URL/MODEL_API_KEY → 回退 mock`,
    );
    return new MockModelClient();
  }

  // anthropic 等暂未实现 → 回退 mock（seam 保留，不阻断离线复现）。
  console.warn(`[model] provider "${provider}" 暂未实现 → 回退 mock`);
  return new MockModelClient();
}
