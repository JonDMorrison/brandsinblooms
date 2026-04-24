import Chip from "@mui/joy/Chip";
import type { SegmentStatus } from "@/hooks/useSegments";

const statusConfig = {
  draft: { color: "warning", label: "Draft" },
  active: { color: "success", label: "Active" },
  paused: { color: "neutral", label: "Paused" },
  archived: { color: "danger", label: "Archived" },
} as const;

export function SegmentStatusBadge({ status }: { status: SegmentStatus }) {
  const config = statusConfig[status];

  return (
    <Chip color={config.color} size="sm" variant="soft">
      {config.label}
    </Chip>
  );
}
