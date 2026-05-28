import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  BLOOM_UPLOADS_BUCKET,
  formatBloomFileSize,
  getBloomAttachmentFilename,
  getBloomAttachmentKind,
  getBloomAttachmentMimeType,
  getBloomAttachmentSize,
  getBloomAttachmentStatus,
  getBloomAttachmentStoragePath,
  truncateBloomFilename,
} from "@/components/bloom/bloomFileUtils";
import { supabase } from "@/integrations/supabase/client";
import type { BloomJsonArray } from "@/hooks/bloom/types";

interface BloomAttachmentDisplayProps {
  attachments: BloomJsonArray;
}

const kindIcons: Record<
  ReturnType<typeof getBloomAttachmentKind>,
  LucideIcon
> = {
  document: FileText,
  image: ImageIcon,
  spreadsheet: FileSpreadsheet,
};

const processingStatuses = new Set(["pending", "processing", "uploading"]);

async function openAttachment(storagePath: string, filename: string) {
  const { data, error } = await supabase.storage
    .from(BLOOM_UPLOADS_BUCKET)
    .createSignedUrl(storagePath, 300);

  if (error || !data?.signedUrl) {
    toast.error("Unable to open attachment", {
      description: error?.message ?? "Please try again.",
    });
    return;
  }

  const opened = window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    toast.error("Unable to open attachment", {
      description: `Allow pop-ups to view ${filename}.`,
    });
  }
}

export function BloomAttachmentDisplay({
  attachments,
}: BloomAttachmentDisplayProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
      {attachments.map((attachment, index) => {
        const filename = getBloomAttachmentFilename(attachment, index);
        const mimeType = getBloomAttachmentMimeType(attachment);
        const storagePath = getBloomAttachmentStoragePath(attachment);
        const status = getBloomAttachmentStatus(attachment);
        const size = getBloomAttachmentSize(attachment);
        const Icon = kindIcons[getBloomAttachmentKind(mimeType, filename)];
        const isProcessing = status ? processingStatuses.has(status) : false;
        const isFailed = status === "failed";
        const clickable = Boolean(storagePath);

        return (
          <JoyChip
            key={`${storagePath ?? filename}-${index}`}
            color="neutral"
            size="sm"
            variant="soft"
            startDecorator={<Icon size={13} strokeWidth={1.9} />}
            endDecorator={
              isProcessing ? (
                <CircularProgress
                  size="sm"
                  thickness={3}
                  sx={{ "--CircularProgress-size": "14px" }}
                />
              ) : isFailed ? (
                <AlertTriangle size={13} strokeWidth={1.9} />
              ) : undefined
            }
            onClick={
              clickable
                ? () => {
                    void openAttachment(storagePath, filename);
                  }
                : undefined
            }
            sx={{
              cursor: clickable ? "pointer" : "default",
              maxWidth: 220,
            }}
          >
            <Stack
              direction="row"
              spacing={0.6}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              <Typography level="body-xs" noWrap sx={{ color: "inherit" }}>
                {truncateBloomFilename(filename)}
              </Typography>
              {size !== null ? (
                <Typography
                  level="body-xs"
                  noWrap
                  sx={{ color: "neutral.500", flexShrink: 0 }}
                >
                  {formatBloomFileSize(size)}
                </Typography>
              ) : null}
            </Stack>
          </JoyChip>
        );
      })}
    </Stack>
  );
}
