import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  formatBloomFileSize,
  getBloomAttachmentKind,
  truncateBloomFilename,
} from "@/components/bloom/bloomFileUtils";
import type { BloomUploadingFile } from "@/hooks/bloom/useBloomFileUpload";

interface BloomFilePreviewProps {
  files: BloomUploadingFile[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

const kindIcons: Record<
  ReturnType<typeof getBloomAttachmentKind>,
  LucideIcon
> = {
  document: FileText,
  image: ImageIcon,
  spreadsheet: FileSpreadsheet,
};

export function BloomFilePreview({
  files,
  onRemove,
  onRetry,
}: BloomFilePreviewProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      {files.map((file) => {
        const Icon =
          kindIcons[getBloomAttachmentKind(file.mimeType, file.filename)];
        const isError = file.status === "error";
        const showProgress = file.status !== "uploaded";

        return (
          <Stack key={file.id} spacing={0.35} sx={{ minWidth: 0 }}>
            <JoyChip
              color={isError ? "danger" : "neutral"}
              size="sm"
              variant="outlined"
              startDecorator={<Icon size={13} strokeWidth={1.9} />}
              endDecorator={
                <IconButton
                  aria-label={`Remove ${file.filename}`}
                  color="neutral"
                  size="sm"
                  variant="plain"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(file.id);
                  }}
                  sx={{ minHeight: 20, minWidth: 20 }}
                >
                  <X size={12} strokeWidth={2} />
                </IconButton>
              }
              sx={{
                alignSelf: "flex-start",
                maxWidth: "100%",
                ...(isError
                  ? {
                      borderColor: "danger.300",
                    }
                  : null),
              }}
            >
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{ minWidth: 0 }}
              >
                <Typography level="body-xs" noWrap sx={{ color: "inherit" }}>
                  {truncateBloomFilename(file.filename)}
                </Typography>
                <Typography
                  level="body-xs"
                  noWrap
                  sx={{ color: "neutral.500", flexShrink: 0 }}
                >
                  {formatBloomFileSize(file.size)}
                </Typography>
              </Stack>
            </JoyChip>

            {showProgress ? (
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{ maxWidth: 280, width: "100%" }}
              >
                <LinearProgress
                  determinate
                  color={isError ? "danger" : "neutral"}
                  size="sm"
                  value={Math.max(4, file.progress)}
                  sx={{ flex: 1, minWidth: 72 }}
                />
                {isError ? (
                  <JoyButton
                    color="danger"
                    size="sm"
                    variant="plain"
                    onClick={() => onRetry(file.id)}
                    sx={{ minHeight: 24, px: 0.75 }}
                  >
                    Retry
                  </JoyButton>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
