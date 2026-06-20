/**
 * 状态胶囊（docs/10 §State pill 单一来源）：圆点 + color/14% 底 + 同色字。
 * 收敛此前在 StatePill(Play) / CreateStudio(顶栏+6 节点) 各自复制的三份内联实现。
 * 颜色传状态 token（--ok/--running/--danger/--pending…）。
 */
export function StatusChip({
  color,
  label,
  pulse = false,
  mono = false,
  size = "md",
}: {
  color: string;
  label: string;
  pulse?: boolean;
  mono?: boolean;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[12px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill ${pad} ${mono ? "font-mono" : "font-medium"}`}
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pulse ? "yh-dotpulse" : ""}`} style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}
