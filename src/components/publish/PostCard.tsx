import * as React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip, { type ChipProps } from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Clock,
  Facebook,
  ImageIcon,
  Instagram,
  Pencil,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PublishItem } from "@/types/publish";

function normalizeLegacyStatus(status: string) {
  switch (status) {
    case "planned":
      return "draft";
    case "posted":
      return "published";
    default:
      return status;
  }
}

function formatGeneratedRelative(
  createdAt: string | null | undefined,
): string | null {
  if (!createdAt) {
    return null;
  }

  const timestamp = new Date(createdAt).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return formatDistanceToNow(timestamp, { addSuffix: true });
}

export type PostCardProps = {
  item: PublishItem;
  publishedAt?: string;
  onEdit: (item: PublishItem) => void;
  onPublishNow: (item: PublishItem) => void;
  onSchedule: (item: PublishItem) => void;
  onDelete: (item: PublishItem) => void;
  disabled?: boolean;
};

const formatStatus = (status: string) => {
  switch (normalizeLegacyStatus(status)) {
    case "draft":
      return "Draft";
    case "generated":
      return "Generated";
    case "review":
      return "In Review";
    case "approved":
      return "Approved";
    case "ready":
      return "Ready";
    case "scheduled":
      return "Scheduled";
    case "publishing":
      return "Publishing";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

const getStatusColor = (status: string): ChipProps["color"] => {
  switch (normalizeLegacyStatus(status)) {
    case "draft":
    case "generated":
      return "neutral";
    case "review":
      return "warning";
    case "approved":
    case "ready":
      return "primary";
    case "scheduled":
      return "success";
    case "publishing":
      return "warning";
    case "published":
      return "success";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
};

const resolvePlatformMeta = (platform: PublishItem["platform"]) => {
  if (platform === "facebook") {
    return {
      label: "Facebook",
      icon: Facebook,
      avatarSx: {
        bgcolor: "#1877F2",
        color: "#FFFFFF",
      },
      badgeSx: {
        bgcolor: "rgba(24, 119, 242, 0.14)",
        color: "#1B4ED8",
      },
    };
  }

  return {
    label: "Instagram",
    icon: Instagram,
    avatarSx: {
      bgcolor: "#E4405F",
      color: "#FFFFFF",
    },
  };
};

const resolvePreviewImage = (item: PublishItem) => {
  if (Array.isArray(item.mediaUrls) && item.mediaUrls.length > 0) {
    return item.mediaUrls[0] ?? null;
  }

  return item.mediaUrl ?? null;
};

const formatAgeLabel = (item: PublishItem, publishedAt?: string) => {
  const timestamp =
    normalizeLegacyStatus(item.status) === "published"
      ? publishedAt
      : item.scheduledFor || item.createdAt;

  return formatGeneratedRelative(timestamp) ?? "Just now";
};

export default function PostCard({
  item,
  publishedAt,
  onEdit,
  onPublishNow,
  onSchedule,
  disabled = false,
}: PostCardProps) {
  const normalizedStatus = normalizeLegacyStatus(item.status);
  const previewImage = resolvePreviewImage(item);
  const caption = item.caption?.trim() ?? "";
  const statusLabel = formatStatus(normalizedStatus);
  const statusChipColor = getStatusColor(normalizedStatus);
  const relativeAge = formatAgeLabel(item, publishedAt);
  const canPublish =
    !disabled &&
    ["approved", "ready", "draft", "generated", "review"].includes(
      normalizedStatus,
    );
  const canSchedule =
    !disabled &&
    ["approved", "ready", "draft", "generated", "review"].includes(
      normalizedStatus,
    );

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "var(--joy-palette-neutral-200, #d4d4d8)",
        bgcolor: "var(--joy-palette-background-surface, #ffffff)",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          borderColor: "var(--joy-palette-neutral-400, #a1a1aa)",
          boxShadow:
            "0 8px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -6px rgba(0,0,0,0.06)",
          transform: "translateY(-3px)",
        },
      }}
    >
      <Box
        sx={{
          m: "calc(-1 * var(--Card-padding))",
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
        }}
      >
        {previewImage ? (
          <AspectRatio
            ratio="4/3"
            sx={{
              borderBottom: "1px solid",
              borderColor: "var(--joy-palette-neutral-100, #f4f4f5)",
            }}
          >
            <Box
              component="img"
              src={previewImage}
              alt={`${item.platform === "facebook" ? "Facebook" : "Instagram"} post preview`}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AspectRatio>
        ) : (
          <AspectRatio
            ratio="4/3"
            sx={{
              bgcolor: "var(--joy-palette-neutral-50, #fafafa)",
              borderBottom: "1px solid",
              borderColor: "var(--joy-palette-neutral-100, #f4f4f5)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  bgcolor: "var(--joy-palette-neutral-100, #f4f4f5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ImageIcon
                  size={22}
                  color="var(--joy-palette-neutral-400, #a1a1aa)"
                />
              </Box>
              <Typography
                level="body-xs"
                sx={{
                  color: "var(--joy-palette-neutral-400, #a1a1aa)",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}
              >
                No media
              </Typography>
            </Box>
          </AspectRatio>
        )}

        <Box sx={{ px: "20px", pt: "16px", pb: "4px" }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar
              sx={{
                width: 24,
                height: 24,
                bgcolor: item.platform === "facebook" ? "#1877F2" : "#E4405F",
                fontSize: "0.6rem",
              }}
            >
              {item.platform === "facebook" ? (
                <Facebook size={13} color="#fff" />
              ) : (
                <Instagram size={13} color="#fff" />
              )}
            </Avatar>

            <Typography
              level="body-xs"
              sx={{
                fontWeight: 600,
                color: "var(--joy-palette-text-secondary)",
              }}
            >
              {item.platform === "facebook" ? "Facebook" : "Instagram"}
            </Typography>

            <Box sx={{ flex: 1 }} />

            <Chip
              variant="soft"
              size="sm"
              color={statusChipColor}
              sx={{
                fontWeight: 600,
                fontSize: "0.675rem",
                height: "22px",
                borderRadius: "6px",
              }}
            >
              {statusLabel}
            </Chip>

            <Typography
              level="body-xs"
              sx={{
                color: "var(--joy-palette-text-tertiary)",
                whiteSpace: "nowrap",
              }}
            >
              {relativeAge}
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ px: "20px", pb: "8px" }}>
          <Typography
            level="body-sm"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.6,
              color: "var(--joy-palette-text-primary)",
            }}
          >
            {caption || "No caption"}
          </Typography>
        </Box>

        <Box
          sx={{
            px: "16px",
            py: "12px",
            borderTop: "1px solid",
            borderColor: "var(--joy-palette-neutral-100, #f4f4f5)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Button
            variant="plain"
            color="neutral"
            size="sm"
            startDecorator={<Pencil size={13} />}
            onClick={() => onEdit(item)}
            disabled={disabled}
            sx={{
              fontWeight: 500,
              fontSize: "0.75rem",
              color: "var(--joy-palette-text-secondary)",
              borderRadius: "8px",
              px: 1.5,
              "&:hover": { bgcolor: "var(--joy-palette-neutral-100, #f4f4f5)" },
            }}
          >
            Edit
          </Button>
          {canSchedule ? (
            <Button
              variant="plain"
              color="neutral"
              size="sm"
              startDecorator={<Clock size={13} />}
              onClick={() => onSchedule(item)}
              disabled={!canSchedule}
              sx={{
                fontWeight: 500,
                fontSize: "0.75rem",
                color: "var(--joy-palette-text-secondary)",
                borderRadius: "8px",
                px: 1.5,
                "&:hover": {
                  bgcolor: "var(--joy-palette-neutral-100, #f4f4f5)",
                },
              }}
            >
              Schedule
            </Button>
          ) : null}

          <Box sx={{ flex: 1 }} />

          {canPublish ? (
            <Button
              variant="solid"
              color="primary"
              size="sm"
              startDecorator={<Send size={13} />}
              onClick={() => onPublishNow(item)}
              disabled={!canPublish}
              sx={{
                fontWeight: 600,
                fontSize: "0.75rem",
                borderRadius: "8px",
                px: 2,
                boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
              }}
            >
              Publish
            </Button>
          ) : null}
        </Box>
      </Box>
    </Card>
  );
}
