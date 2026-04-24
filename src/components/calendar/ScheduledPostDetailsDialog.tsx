import Box from "@mui/joy/Box";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CalendarClock, ExternalLink, Send } from "lucide-react";
import { format } from "date-fns";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";

interface ScheduledPostDetailsDialogProps {
  post: any | null;
  open: boolean;
  onClose: () => void;
  onViewContent?: (task: any) => void;
}

export function ScheduledPostDetailsDialog({
  post,
  open,
  onClose,
  onViewContent,
}: ScheduledPostDetailsDialogProps) {
  if (!post) {
    return null;
  }

  const publishAt = post.publish_at ? new Date(post.publish_at) : null;
  const caption = String(post.content?.caption ?? "").trim();
  const linkedTask = post.content_tasks ?? null;

  return (
    <JoyDialog
      open={open}
      onClose={() => onClose()}
      title="Scheduled Post"
      description="Publishing details and linked content"
      size="md"
      startDecorator={<Send size={20} />}
    >
      <JoyDialogContent>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <JoyChip color="primary" variant="soft">
              {String(post.platform ?? "Post")}
            </JoyChip>
            <JoyStatusChip
              status={String(post.status ?? "queued")}
              tone="info"
            />
          </Stack>

          <Sheet
            variant="soft"
            color="primary"
            sx={{ borderRadius: "lg", px: 2, py: 1.75 }}
          >
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CalendarClock size={16} />
                <Typography level="body-sm" fontWeight="lg">
                  {publishAt
                    ? format(publishAt, "PPPp")
                    : "Publish time unavailable"}
                </Typography>
              </Stack>
              <Typography level="body-xs" color="neutral">
                {post.mode
                  ? `Mode: ${String(post.mode).toLowerCase()}`
                  : "Queued for publishing"}
              </Typography>
            </Stack>
          </Sheet>

          <Box>
            <Typography level="title-sm">Content Preview</Typography>
            <Sheet
              variant="outlined"
              sx={{ borderRadius: "lg", px: 2, py: 1.75, mt: 1.25 }}
            >
              <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
                {caption ||
                  "No caption preview is available for this scheduled post."}
              </Typography>
            </Sheet>
          </Box>

          {post.error_message ? (
            <Sheet
              color="danger"
              variant="soft"
              sx={{ borderRadius: "lg", px: 2, py: 1.5 }}
            >
              <Typography level="body-sm" color="danger">
                {String(post.error_message)}
              </Typography>
            </Sheet>
          ) : null}

          {post.content?.media_url ? (
            <Link
              href={String(post.content.media_url)}
              target="_blank"
              rel="noreferrer"
            >
              Open media asset
            </Link>
          ) : null}
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        {linkedTask ? (
          <JoyButton
            variant="soft"
            color="primary"
            startDecorator={<ExternalLink size={14} />}
            onClick={() => onViewContent?.(linkedTask)}
          >
            View Content
          </JoyButton>
        ) : null}
        <JoyButton
          bloomVariant="ghost"
          color="neutral"
          onClick={() => onClose()}
        >
          Close
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
