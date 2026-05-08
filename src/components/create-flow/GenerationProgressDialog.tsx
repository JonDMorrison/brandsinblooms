import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import LinearProgress from "@mui/joy/LinearProgress";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  BookText,
  CheckCircle2,
  Clapperboard,
  Facebook,
  Image as ImageIcon,
  Instagram,
  Mail,
  Newspaper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ContentGenerationPhase,
  ContentGenerationStatus,
  ImageTaskState,
  ImageGenerationStatus,
} from "@/hooks/useContentGenerationOrchestrator";

interface GenerationProgressDialogProps {
  open: boolean;
  bundleId: string | null;
  channels: string[];
  topicTitle: string;
  phase: ContentGenerationPhase;
  contentStatus: ContentGenerationStatus;
  imageTasks: Record<string, ImageTaskState>;
  onReviewContent: () => void;
  onGoToLibrary: () => void;
  onRetry: () => void;
  onClose: () => void;
}

type ChannelMeta = {
  label: string;
  icon: LucideIcon;
};

const CHANNEL_META: Record<string, ChannelMeta> = {
  blog: { label: "Blog Article", icon: BookText },
  facebook: { label: "Facebook Post", icon: Facebook },
  facebook_carousel: { label: "Facebook Carousel", icon: ImageIcon },
  instagram: { label: "Instagram Post", icon: Instagram },
  instagram_carousel: { label: "Instagram Carousel", icon: ImageIcon },
  newsletter: { label: "Newsletter", icon: Mail },
  video: { label: "Video Script", icon: Clapperboard },
};

function getChannelMeta(channel: string): ChannelMeta {
  return CHANNEL_META[channel] || { label: "Content", icon: Newspaper };
}

const IMAGEABLE_CHANNELS = new Set([
  "blog",
  "facebook",
  "instagram",
  "newsletter",
]);

type VisualPhase = "content" | "images";

const PHASE_TRANSITION_DELAY_MS = 250;

function getVisualPhase(phase: ContentGenerationPhase): VisualPhase {
  return phase === "images" || phase === "complete" ? "images" : "content";
}

function ContentPhaseRow({
  channel,
  contentStatus,
}: {
  channel: string;
  contentStatus: ContentGenerationStatus;
}) {
  const meta = getChannelMeta(channel);
  const Icon = meta.icon;
  const rowContentStatus =
    contentStatus === "idle" ? "generating" : contentStatus;
  const isCompleted = rowContentStatus === "completed";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: "10px",
        border: "1px solid",
        borderColor: isCompleted ? "success.200" : "neutral.100",
        bgcolor: isCompleted ? "success.50" : "background.surface",
        marginBottom: "8px",
        transition: "all 0.3s ease",
      }}
    >
      <Box
        sx={{
          width: "20px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "neutral.500",
          flexShrink: 0,
          "& svg": {
            width: "20px",
            height: "20px",
          },
        }}
      >
        <Icon />
      </Box>

      <Typography
        level="body-sm"
        sx={{
          fontWeight: 600,
          color: "neutral.700",
          marginLeft: "12px",
          flex: 1,
        }}
      >
        {meta.label}
      </Typography>

      <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        {isCompleted ? (
          <Box
            sx={{
              color: "success.500",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              "& svg": {
                width: "18px",
                height: "18px",
              },
            }}
          >
            <CheckCircle2 />
          </Box>
        ) : (
          <CircularProgress
            size="sm"
            variant="soft"
            color="primary"
            sx={{ "--CircularProgress-size": "18px" }}
          />
        )}
      </Box>
    </Box>
  );
}

function ImagePhaseRow({
  channel,
  task,
}: {
  channel: string;
  task: ImageTaskState;
}) {
  const meta = getChannelMeta(channel);
  const Icon = meta.icon;

  const thumbnailUrl = task.thumbnailUrl || task.imageUrl;
  const isGenerating = task.status === "generating";
  const isCompleted = task.status === "completed";
  const isFailed = task.status === "failed";
  const isSkipped = task.status === "skipped";
  const subtitle = task.imageQuery?.trim() || "";

  return (
    <Box
      sx={{
        padding: "14px 16px",
        borderRadius: "10px",
        border: "1px solid",
        borderColor: isCompleted ? "success.200" : "neutral.100",
        bgcolor: isCompleted ? "success.50" : "background.surface",
        marginBottom: "8px",
        transition: "all 0.4s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box
          sx={{
            width: "20px",
            height: "20px",
            color: "neutral.500",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "& svg": {
              width: "20px",
              height: "20px",
            },
          }}
        >
          <Icon />
        </Box>

        <Typography
          level="body-sm"
          sx={{
            fontWeight: 600,
            color: "neutral.700",
            marginLeft: "12px",
            flex: 1,
          }}
        >
          {meta.label}
        </Typography>

        {isCompleted ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 10px",
                borderRadius: "100px",
                bgcolor: "success.100",
                color: "success.700",
              }}
            >
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  "& svg": {
                    width: "13px",
                    height: "13px",
                  },
                }}
              >
                <CheckCircle2 />
              </Box>
              <Typography
                sx={{ fontSize: "11px", fontWeight: 600, lineHeight: 1 }}
              >
                Ready
              </Typography>
            </Box>

            {thumbnailUrl ? (
              <Box
                component="img"
                src={thumbnailUrl}
                alt={`${meta.label} image preview`}
                sx={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: "1px solid",
                  borderColor: "neutral.200",
                }}
              />
            ) : null}
          </Box>
        ) : null}

        {isGenerating ? (
          <CircularProgress
            size="sm"
            variant="soft"
            color="primary"
            sx={{ "--CircularProgress-size": "18px" }}
          />
        ) : null}

        {isSkipped ? (
          <Typography sx={{ fontSize: "11px", color: "neutral.400" }}>
            Skipped
          </Typography>
        ) : null}

        {isFailed ? (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 10px",
              borderRadius: "100px",
              bgcolor: "warning.100",
              color: "warning.700",
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                "& svg": {
                  width: "13px",
                  height: "13px",
                },
              }}
            >
              <AlertTriangle />
            </Box>
            <Typography
              sx={{ fontSize: "11px", fontWeight: 600, lineHeight: 1 }}
            >
              Failed
            </Typography>
          </Box>
        ) : null}
      </Box>

      {subtitle ? (
        <Typography
          sx={{
            fontSize: "11px",
            fontWeight: 500,
            color: "neutral.400",
            marginTop: "6px",
            marginLeft: "32px",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </Typography>
      ) : null}

      {isGenerating ? (
        <LinearProgress
          variant="soft"
          color="primary"
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "2px",
            borderRadius: 0,
            "--LinearProgress-radius": "0px",
          }}
        />
      ) : null}
    </Box>
  );
}

export function GenerationProgressDialog({
  open,
  bundleId,
  channels,
  topicTitle,
  phase,
  contentStatus,
  imageTasks,
  onReviewContent,
  onGoToLibrary,
  onRetry,
  onClose,
}: GenerationProgressDialogProps) {
  const contentComplete = contentStatus === "completed";
  const contentFailed = contentStatus === "failed";
  const canDismiss = contentComplete || contentFailed;
  const imageableChannels = useMemo(
    () => channels.filter((channel) => IMAGEABLE_CHANNELS.has(channel)),
    [channels],
  );
  const completedImages = imageableChannels.filter(
    (channel) => imageTasks[channel]?.status === "completed",
  ).length;
  const failedImages = imageableChannels.filter(
    (channel) => imageTasks[channel]?.status === "failed",
  ).length;
  const generatingImages = imageableChannels.filter(
    (channel) => imageTasks[channel]?.status === "generating",
  ).length;
  const visualPhase = getVisualPhase(phase);
  const [renderedPhase, setRenderedPhase] = useState<VisualPhase>(visualPhase);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (visualPhase === renderedPhase) {
      return;
    }

    setIsTransitioning(true);
    transitionTimeoutRef.current = window.setTimeout(() => {
      setRenderedPhase(visualPhase);
      setIsTransitioning(false);
      transitionTimeoutRef.current = null;
    }, PHASE_TRANSITION_DELAY_MS);

    return () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [renderedPhase, visualPhase]);

  useEffect(
    () => () => {
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    },
    [],
  );

  const showCompletionState = phase === "complete";
  const displayPhase = showCompletionState ? "complete" : renderedPhase;
  const postsCount = channels.length;
  const imagesCount = completedImages;
  const totalImages = imageableChannels.length;
  const headerProgressText =
    displayPhase === "content"
      ? `Generating text content for ${channels.length} channels…`
      : totalImages > 0
        ? `${completedImages} of ${totalImages} images ready`
        : "Creating AI images for your posts…";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (canDismiss) {
          onClose();
        }
      }}
    >
      <ModalDialog
        variant="plain"
        sx={{
          width: "480px",
          maxWidth: "95vw",
          maxHeight: "85vh",
          borderRadius: "16px",
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid",
          borderColor: "neutral.100",
          bgcolor: "background.surface",
        }}
      >
        <Box
          sx={{ display: "flex", flexDirection: "column", maxHeight: "85vh" }}
        >
          <Box sx={{ padding: "24px 28px 16px 28px", flexShrink: 0 }}>
            <Box
              sx={{
                opacity: isTransitioning ? 0 : 1,
                transition: "opacity 0.25s ease",
              }}
            >
              {displayPhase !== "complete" ? (
                <Typography
                  sx={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "primary.500",
                    marginBottom: "8px",
                  }}
                >
                  {displayPhase === "content" ? "Step 1 of 2" : "Step 2 of 2"}
                </Typography>
              ) : null}

              <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Box
                  sx={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    bgcolor:
                      displayPhase === "complete"
                        ? "success.500"
                        : "primary.500",
                    animation:
                      displayPhase === "complete"
                        ? "none"
                        : "pulse 1.5s ease-in-out infinite",
                    "@keyframes pulse": {
                      "0%, 100%": { opacity: 1, transform: "scale(1)" },
                      "50%": { opacity: 0.5, transform: "scale(0.85)" },
                    },
                  }}
                />
                <Typography
                  level="title-lg"
                  sx={{
                    fontWeight: 700,
                    color:
                      displayPhase === "complete"
                        ? "success.700"
                        : "neutral.800",
                  }}
                >
                  {displayPhase === "content"
                    ? "Creating your content"
                    : displayPhase === "images"
                      ? "Generating your images"
                      : "All done!"}
                </Typography>
              </Box>

              <Typography
                level="body-sm"
                sx={{
                  color: "neutral.500",
                  marginTop: displayPhase === "complete" ? "2px" : "4px",
                  paddingLeft: "18px",
                }}
              >
                {displayPhase === "complete"
                  ? `${postsCount} posts created · ${imagesCount} images generated`
                  : topicTitle}
              </Typography>

              {displayPhase !== "complete" ? (
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.400", marginTop: "12px" }}
                >
                  {displayPhase === "images"
                    ? headerProgressText
                    : `Generating text content for ${channels.length} channels…`}
                </Typography>
              ) : null}
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              padding: "0 28px 16px 28px",
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: "neutral.300",
                borderRadius: "4px",
              },
            }}
          >
            <Box
              sx={{
                opacity: isTransitioning ? 0 : 1,
                transition: "opacity 0.25s ease",
              }}
            >
              {displayPhase === "content"
                ? channels.map((channel) => (
                    <ContentPhaseRow
                      key={`content-${channel}`}
                      channel={channel}
                      contentStatus={contentStatus}
                    />
                  ))
                : channels.map((channel) => (
                    <ImagePhaseRow
                      key={`image-${channel}`}
                      channel={channel}
                      task={
                        imageTasks[channel] || {
                          status: IMAGEABLE_CHANNELS.has(channel)
                            ? "waiting"
                            : "skipped",
                          imageQuery: "",
                          imageUrl: null,
                          thumbnailUrl: null,
                          error: null,
                        }
                      }
                    />
                  ))}

              {displayPhase !== "content" ? (
                <Box sx={{ padding: "8px 0 4px 0" }}>
                  <Typography
                    level="body-xs"
                    sx={{ color: "neutral.400", textAlign: "center" }}
                  >
                    {completedImages} of {totalImages} images ready
                  </Typography>
                </Box>
              ) : null}

              {contentFailed ? (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "10px",
                    padding: "16px 0 4px 0",
                  }}
                >
                  <Button
                    color="primary"
                    size="lg"
                    onClick={onRetry}
                    sx={{
                      borderRadius: "10px",
                      fontWeight: 600,
                      paddingX: "28px",
                      fontSize: "14px",
                    }}
                  >
                    Try Again
                  </Button>
                  <Button
                    variant="outlined"
                    color="neutral"
                    size="lg"
                    onClick={onClose}
                    sx={{
                      borderRadius: "10px",
                      fontWeight: 600,
                      paddingX: "28px",
                      fontSize: "14px",
                    }}
                  >
                    Close
                  </Button>
                </Box>
              ) : null}
            </Box>
          </Box>

          {phase === "complete" && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                padding: "16px 28px 24px 28px",
                flexShrink: 0,
                borderTop: "1px solid",
                borderColor: "neutral.100",
              }}
            >
              <Button
                color="primary"
                size="lg"
                disabled={!bundleId}
                onClick={onReviewContent}
                sx={{
                  borderRadius: "10px",
                  fontWeight: 600,
                  paddingX: "28px",
                  fontSize: "14px",
                }}
              >
                Review Content
              </Button>
              <Button
                variant="outlined"
                color="neutral"
                size="lg"
                onClick={onGoToLibrary}
                sx={{
                  borderRadius: "10px",
                  fontWeight: 600,
                  paddingX: "28px",
                  fontSize: "14px",
                }}
              >
                Go to Library
              </Button>
            </Box>
          )}
        </Box>
      </ModalDialog>
    </Modal>
  );
}
