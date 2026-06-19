import type { PlayStatus } from "./PlayShell";

const MAP: Record<PlayStatus, { label: string; color: string }> = {
  loading: { label: "Loading", color: "var(--running)" },
  loaded: { label: "Loaded", color: "var(--ok)" },
  failed: { label: "Failed", color: "var(--danger)" },
  ended: { label: "Ended", color: "var(--text-muted)" },
};

/** Status pill (docs/10 §State pill): <color>/14% bg, solid <color> text + leading dot. */
export function StatePill({ status }: { status: PlayStatus }) {
  const { label, color } = MAP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}
