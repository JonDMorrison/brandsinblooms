import Chip from "@mui/joy/Chip";
import type { SegmentKind } from "@/hooks/useSegments";

export function SegmentTypeBadge({ type }: { type: SegmentKind }) {
  return (
    <Chip
      color={type === "dynamic" ? "primary" : "neutral"}
      size="sm"
      variant={type === "dynamic" ? "soft" : "outlined"}
    >
      {type === "dynamic" ? "Dynamic" : "Static"}
    </Chip>
  );
}
