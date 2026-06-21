"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const STEP_LABEL: Record<string, string> = {
  INGEST: "读取创意",
  PLANNER: "规划",
  ASSET_CURATOR: "素材",
  CODER: "改写代码",
  VALIDATOR: "校验",
  PACKAGER: "打包发布",
};

/**
 * 自然语言微调（refine，owner-only）：一句话指令 → POST /api/tasks{mode:refine} → 轮询任务 →
 * 成功后新版本自动发布、router.refresh() 看到改动；失败显示原因（原游戏不变）。
 */
export function RefinePanel({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    setStep("提交中");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, prompt, mode: "refine" }),
      });
      if (res.status === 401) {
        router.push(`/login?next=/games/${gameId}`);
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setErr(j?.error?.message ?? `提交失败 ${res.status}`);
        return;
      }
      const { taskId } = (await res.json()) as { taskId: string };

      // 轮询任务（真模型改写约 1–3 分钟）。
      const t0 = Date.now();
      while (Date.now() - t0 < 6 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 2500));
        const s = await fetch(`/api/tasks/${taskId}`).then((r) => (r.ok ? r.json() : null));
        const st: string | undefined = s?.task?.status;
        const cur: string | undefined = s?.task?.currentStep;
        setStep(cur ? (STEP_LABEL[cur] ?? cur) : st ?? null);
        if (st === "SUCCEEDED") {
          setMsg("微调完成 —— 已更新为新版本，下方游戏即为最新效果");
          setText("");
          router.refresh();
          break;
        }
        if (st === "FAILED") {
          setErr(s?.task?.error ?? "微调失败，请换种说法重试");
          break;
        }
      }
    } catch {
      setErr("网络错误，请重试");
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  return (
    <section className="rounded-lg border border-[rgba(124,92,255,.35)] bg-[rgba(124,92,255,.05)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[14px] font-semibold text-ink">✨ 自然语言微调</h2>
        <span className="rounded-pill border border-hairline px-2 py-0.5 font-mono text-[10px] text-ink-faint">
          AI 在现有游戏上改
        </span>
      </div>
      <p className="mb-3 text-[12px] text-ink-muted">
        用一句话描述想改的地方，AI 基于当前游戏代码定向修改并出新版本（不重头生成）。
      </p>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          disabled={busy}
          placeholder="例如：把金币改成三角形 / 速度再快一点 / 背景换成深蓝"
          className="h-10 flex-1 rounded-lg border border-hairline bg-surface-inset px-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-hairline-strong disabled:opacity-60"
        />
        <Button variant="primary" size="md" onClick={() => void submit()} disabled={busy || !text.trim()}>
          {busy ? (step ?? "生成中…") : "微调"}
        </Button>
      </div>
      {busy ? (
        <p className="mt-2 text-[12px] text-ink-muted">
          正在「{step ?? "处理"}」… 真模型改写约 1–3 分钟，请勿离开本页。
        </p>
      ) : null}
      {msg ? <p className="mt-2 text-[12px]" style={{ color: "var(--ok)" }}>{msg}</p> : null}
      {err ? <p className="mt-2 text-[12px] text-danger">{err}</p> : null}
    </section>
  );
}
