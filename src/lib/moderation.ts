/**
 * 内容审核 seam（docs/07 §内容审核）。生成前对创意 prompt 做一层拦截。
 *
 * 当前实现 = **本地启发式禁词**（默认，无 key 可离线跑通，红线⑤）：命中清单 → 拒绝建任务。
 * 这是可插拔 seam：把 `moderatePrompt` 内部换成真实审核 API（OpenAI moderation / 自建分类器）
 * 即可升级为模型级审核——调用点（POST /api/tasks）与返回契约不变。
 *
 * 类别级关键词（中英），聚焦明显不该出现在休闲小游戏创意里的内容：
 * 性暴露 / 儿童性化 / 极端血腥 / 武器爆炸物制造 / 仇恨与恐怖主义 / 制毒。
 * 启发式必有漏报与误报——它是 demo 级防线 + 接真模型的挂点，不是生产级审核。
 */

const BLOCKLIST: RegExp[] = [
  // 性暴露 / 成人
  /\b(porn|pornographic|hardcore|xxx|nsfw|nude|naked sex|sexual(ly)? explicit)\b/i,
  /色情|淫秽|裸体|성인|做爱|情色/,
  // 儿童性化（零容忍）
  /\b(child\s*porn|cp\s*porn|underage\s*sex|loli(con)?|pedophil)/i,
  /儿童色情|幼女|恋童/,
  // 极端血腥 / 现实暴力
  /\b(behead(ing)?|dismember|gore|graphic\s*(violence|murder)|torture\s*(real|people))\b/i,
  /斩首|血腥屠杀|虐杀|肢解/,
  // 武器 / 爆炸物制造
  /\b(make|build|how to (make|build))\s+(a\s+)?(bomb|explosive|gun|firearm|grenade)\b/i,
  /制造(炸弹|爆炸物|枪支|武器)|炸弹制作|怎么造(炸弹|枪)/,
  // 制毒
  /\b(synthesize|cook|manufacture)\s+(meth|methamphetamine|heroin|cocaine|fentanyl)\b/i,
  /制毒|合成(冰毒|海洛因|甲基苯丙胺)/,
  // 仇恨 / 恐怖主义
  /\b(terrorist\s*attack|ethnic\s*cleansing|genocide\s*how)\b/i,
  /恐怖袭击|种族清洗|圣战招募/,
];

export type ModerationResult = { allowed: boolean; reason?: string };

/** 审核创意 prompt。命中禁词 → allowed:false + 中文原因。空/纯文本 → 放行。 */
export function moderatePrompt(text: string): ModerationResult {
  const t = (text ?? "").normalize("NFKC");
  for (const rx of BLOCKLIST) {
    if (rx.test(t)) {
      return {
        allowed: false,
        reason: "创意包含不允许的内容（性暴露 / 极端暴力 / 武器或毒品制造 / 仇恨等），请修改后再试。",
      };
    }
  }
  return { allowed: true };
}
