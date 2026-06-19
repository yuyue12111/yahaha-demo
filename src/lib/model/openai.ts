import { env } from "../env";
import type { ChatInput, ChatResult, ModelClient, VisionInput, VisionResult } from "./types";

/**
 * OpenAI 兼容客户端（覆盖 codex=Yahaha GPT-5.5 / openai）。纯 fetch，无 SDK 依赖。
 * 仅在配置了 MODEL_BASE_URL + MODEL_API_KEY 时被选中（见 index.ts）；否则退化为 mock。
 * 结构化输出走 JSON mode + schema 校验；校验失败抛出 → 节点内有限修复重试（docs/04/08）。
 */
export class OpenAICompatibleClient implements ModelClient {
  readonly provider: string;
  constructor(provider: string) {
    this.provider = provider;
  }

  private async call(body: Record<string, unknown>): Promise<{
    content: string;
    tokensIn: number;
    tokensOut: number;
  }> {
    const res = await fetch(`${env.MODEL_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.MODEL_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`model HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
    };
  }

  async chat<T = unknown>(input: ChatInput): Promise<ChatResult<T>> {
    const messages = [
      ...(input.system ? [{ role: "system", content: input.system }] : []),
      ...input.messages,
    ];
    const body: Record<string, unknown> = { model: env.MODEL_NAME, messages };
    if (input.schema) body.response_format = { type: "json_object" };

    const { content, tokensIn, tokensOut } = await this.call(body);

    if (input.schema) {
      const object = input.schema.parse(JSON.parse(content)) as T; // 抛 → 节点修复重试
      return { object, tokensIn, tokensOut };
    }
    return { text: content, tokensIn, tokensOut };
  }

  async vision(input: VisionInput): Promise<VisionResult> {
    const imageUrl = input.imageUrl;
    if (!imageUrl) {
      // 无图直接退化为纯文本提示（与 mock 行为对齐）。
      return { text: `(no image) ${input.hint ?? ""}`.trim(), tokensIn: 8, tokensOut: 8 };
    }
    const { content, tokensIn, tokensOut } = await this.call({
      model: env.VISION_MODEL_NAME || env.MODEL_NAME,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: input.prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });
    return { text: content, tokensIn, tokensOut };
  }
}
