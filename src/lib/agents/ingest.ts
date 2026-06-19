import { objectExists } from "../storage";
import type { AgentContext, AssetRef, IngestOutput, NodeResult } from "./types";
import { IngestOutput as IngestOutputSchema } from "./types";

/**
 * INGEST —— 归一多模态输入。对每个上传素材：HEAD 校验真实存在于 MinIO（证"上传被引用"），
 * 再经 model.vision 抽取描述（mock 用文件名/MIME 做种，让上传**真影响**后续生成）。
 * 无 vision 模型 → 退化为纯文本 ingest（描述仍由文件名派生）。
 */
export async function runIngest(
  ctx: AgentContext,
  assetRefs: AssetRef[],
): Promise<NodeResult<IngestOutput>> {
  const assetDescriptions: { assetId: string; description: string }[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let missing = 0;

  for (const ref of assetRefs) {
    const exists = await objectExists(ref.key);
    if (!exists) {
      missing++;
      assetDescriptions.push({ assetId: ref.assetId, description: `(缺失于远端: ${ref.key})` });
      continue;
    }
    const v = await ctx.model.vision({
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
    outputSummary: `brief 就绪${assetDescriptions.length ? ` + ${assetDescriptions.length} 条素材描述` : ""}`,
    tokensIn,
    tokensOut,
  };
}
