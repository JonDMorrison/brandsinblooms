import Typography from "@mui/joy/Typography";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import type { SegmentListItem } from "@/hooks/useSegments";

export interface SegmentDeleteDialogProps {
  segment: SegmentListItem | null;
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export function SegmentDeleteDialog({
  segment,
  open,
  loading = false,
  onClose,
  onConfirm,
}: SegmentDeleteDialogProps) {
  return (
    <JoyAlertDialog
      confirmLabel="Archive segment"
      description="This keeps historical references intact while removing the segment from active lists."
      loading={loading}
      onClose={onClose}
      onConfirm={onConfirm}
      open={open}
      title={segment ? `Archive ${segment.name}?` : "Archive segment?"}
      variant="danger"
    >
      {segment ? (
        <Typography level="body-sm" color="neutral">
          Existing campaign and activity references stay intact. You can still
          restore the rules later by copying them from history.
        </Typography>
      ) : null}
    </JoyAlertDialog>
  );
}
