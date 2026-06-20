import { objectExists, getObjectBytes } from "../storage";
import type { AgentContext, AssetRef, IngestOutput, NodeResult } from "./types";
import { IngestOutput as IngestOutputSchema } from "./types";

/** 真像素 vision 上限：图片 ≤ 此大小才内联 base64 喂模型，超限退化 hint-only（避免巨 payload）。 */
const MAX_VISION_BYTES = 4 * 1024 * 1024;

/**
 * INGEST —— 归一多模态输入。对每个上传素材：HEAD 校验真实存在于 MinIO（证"上传被引用"），
 * 再经 model.vision 抽取描述，让上传**真影响**后续生成：
 *  - 图片素材（image/*，≤4MB）：从 MinIO 读真字节（storage.getObjectBytes，守红线①）→ base64 data URL
 *    传入 vision({imageUrl})。真实 GPT-5.5 由此**真读像素**（data URL 内联，远端端点也可达，
 *    规避 presigned localhost:9000 对外不可达的坑）。mock 忽略 imageUrl，仍按 hint/seedKey 确定性（红线③不变）。
 *  - 非图片 / 超限 / 读失败：退化为文件名/MIME hint（描述仍随上传变化）。
 */
export async function runIngest(
  ctx: AgentContext,
  assetRefs: AssetRef[],
): Promise<NodeResult<IngestOutput>> {
  const assetDescriptions: { assetId: string; description: string }[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let missing = 0;
  let pixelsRead = 0;

  for (const ref of assetRefs) {
    const exists = await objectExists(ref.key);
    if (!exists) {
      missing++;
      assetDescriptions.push({ assetId: ref.assetId, description: `(缺失于远端: ${ref.key})` });
      continue;
    }
    // 图片 → 内联真像素（base64 data URL）；失败/超限/非图片 → undefined（hint-only 退化）。
    let imageUrl: string | undefined;
    if (ref.contentType.startsWith("image/")) {
      try {
        const bytes = await getObjectBytes(ref.key);
        if (bytes.byteLength <= MAX_VISION_BYTES) {
          imageUrl = `data:${ref.contentType};base64,${Buffer.from(bytes).toString("base64")}`;
          pixelsRead++;
        }
      } catch {
        /* 读字节失败 → 退化 hint-only，不阻断流水线 */
      }
    }
    const v = await ctx.model.vision({
      imageUrl,
      prompt: "描述这张上传素材的主体与色调，用于游戏资产规划。",
      hint: `${ref.contentType} · ${ref.key.split("/").pop()}`,
      seedKey: `${ctx.seedKey}:${ref.assetId}`,
    });
    tokensIn += v.tokensIn;
    tokensOut += v.tokensOut;
    assetDescriptions.push({ assetId: ref.assetId, description: v.text });
  }

  const assetLine =
    assetRefs.length === 0
      ? "无上传素材（纯文本创意）"
      : `${assetRefs.length} 个上传素材${missing ? `（${missing} 个缺失）` : ""}`;
  const brief = [
    `创意：${ctx.prompt}`,
    assetDescriptions.length ? `素材线索：${assetDescriptions.map((d) => d.description).join("；")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const output = IngestOutputSchema.parse({ brief, assetDescriptions });
  return {
    output,
    inputSummary: `prompt(${ctx.prompt.length} 字) + ${assetLine}`,
    outputSummary: `brief 就绪${assetDescriptions.length ? ` + ${assetDescriptions.length} 条素材描述` : ""}${pixelsRead ? ` + ${pixelsRead} 张真像素送入 vision` : ""}`,
    tokensIn,
    tokensOut,
  };
}
