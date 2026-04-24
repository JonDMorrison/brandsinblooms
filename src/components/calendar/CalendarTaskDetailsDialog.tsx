import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Divider from "@mui/joy/Divider";
import { Calendar, FileText, Tag } from "lucide-react";
import { format } from "date-fns";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";

interface CalendarTaskDetailsDialogProps {
  task: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarTaskDetailsDialog({
  task,
  isOpen,
  onClose,
}: CalendarTaskDetailsDialogProps) {
  if (!task) return null;

  return (
    <JoyDialog
      open={isOpen}
      onClose={() => onClose()}
      title={task.campaigns?.title || task.title || "Task details"}
      description="Scheduled content task"
      size="lg"
      startDecorator={<FileText size={18} />}
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <JoyChip color="warning" variant="soft">
              {task.post_type || "task"}
            </JoyChip>
            <JoyStatusChip status={task.status} />
            {task.scheduled_date ? (
              <JoyChip color="neutral" variant="soft">
                {format(new Date(task.scheduled_date), "MMM d, yyyy")}
              </JoyChip>
            ) : null}
          </Stack>

          <Sheet
            variant="soft"
            color="primary"
            sx={{ borderRadius: "lg", p: 1.5 }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Calendar size={14} />
                <Typography level="body-sm">
                  {task.scheduled_date
                    ? format(
                        new Date(task.scheduled_date),
                        "EEEE, MMMM d, yyyy",
                      )
                    : "Unscheduled"}
                </Typography>
              </Stack>
              {task.title ? (
                <Typography level="body-sm">{task.title}</Typography>
              ) : null}
              {task.notes ? (
                <Typography level="body-sm">{task.notes}</Typography>
              ) : null}
            </Stack>
          </Sheet>

          <Divider />

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tag size={14} />
              <Typography level="title-sm">Generated Content</Typography>
            </Stack>
            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "lg",
                p: 1.5,
                maxHeight: 360,
                overflow: "auto",
              }}
            >
              <Typography
                level="body-sm"
                sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
              >
                {task.ai_output ||
                  "No AI content has been generated for this task yet."}
              </Typography>
            </Sheet>
          </Stack>
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton
          color="neutral"
          bloomVariant="ghost"
          onClick={() => onClose()}
        >
          Close
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
