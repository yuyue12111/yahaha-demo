import type { PlayStatus } from "./PlayShell";
import { StatusChip } from "@/components/ui/StatusChip";

const MAP: Record<PlayStatus, { label: string; color: string }> = {
  loading: { label: "Loading", color: "var(--running)" },
  loaded: { label: "Loaded", color: "var(--ok)" },
  failed: { label: "Failed", color: "var(--danger)" },
  ended: { label: "Ended", color: "var(--text-muted)" },
};

/** Play 状态胶囊（复用共享 StatusChip）。loading 态圆点脉冲，与 Create 时间线语言一致。 */
export function StatePill({ status }: { status: PlayStatus }) {
  const { label, color } = MAP[status];
  return <StatusChip color={color} label={label} pulse={status === "loading"} />;
}
