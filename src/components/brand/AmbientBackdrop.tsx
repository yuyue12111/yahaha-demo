/**
 * 全站共享氛围层（整体性单一来源）：把原本散落在 Create/Play/auth/me 各页手抄的 radial/conic 辉光
 * 收敛成一个组件，统一品牌锚点与色相，让跨屏切换有同一基调。配色走品牌色变量（globals.css :root）。
 * 纯装饰：`pointer-events:none` + `aria-hidden`，对红线②（沙箱 iframe）零影响。
 *
 * - hero   ：Create 空状态——呼吸月食辉光 + 极慢轨道环 + 暗角（放在 relative 容器内，content z-10 之上覆盖）。
 * - subtle ：Home/我的/详情——克制的顶部双辉光；用 `-z-10`（配父级 isolate）垫在内容之下，无需包裹 children。
 * - auth   ：登录/注册——居中双 radial（替代 login/register 复制两份的内联配方）。
 */
export function AmbientBackdrop({ variant = "subtle" }: { variant?: "hero" | "subtle" | "auth" }) {
  if (variant === "hero") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 78% at 50% 0%, color-mix(in srgb, var(--brand-purple) 10%, transparent), transparent 58%)" }}
        />
        <div
          className="yh-breathe absolute left-1/2 top-[27%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--brand-cyan) 13%, transparent), color-mix(in srgb, var(--brand-purple) 8%, transparent) 46%, transparent 72%)" }}
        />
        <div
          className="yh-orbit absolute left-1/2 top-[27%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[.06]"
          style={{ background: "conic-gradient(from 0deg, transparent, var(--brand-purple) 12%, transparent 32%, transparent 62%, var(--brand-cyan) 78%, transparent 96%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(132% 100% at 50% 38%, transparent 54%, rgba(6,4,13,.62) 100%)" }}
        />
      </div>
    );
  }

  if (variant === "auth") {
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 28% 18%, color-mix(in srgb, var(--brand-purple) 18%, transparent), transparent 52%), radial-gradient(circle at 80% 92%, color-mix(in srgb, var(--brand-cyan) 14%, transparent), transparent 52%)",
          }}
        />
      </div>
    );
  }

  // subtle —— 配父级 `relative isolate`，-z-10 垫在内容之下，全幅、极克制。
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(85% 48% at 50% -10%, color-mix(in srgb, var(--brand-purple) 9%, transparent), transparent 60%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(55% 38% at 93% 2%, color-mix(in srgb, var(--brand-cyan) 7%, transparent), transparent 55%)" }}
      />
    </div>
  );
}
