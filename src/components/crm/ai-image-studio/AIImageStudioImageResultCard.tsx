import React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { formatDistanceToNow } from "date-fns";
import { Check, ChevronRight, Download, ImageOff } from "lucide-react";
import { toast } from "sonner";
import type {
  AIImageStudioAspectRatio,
  AIImageStudioImageResult,
  AIImageStudioStylePreset,
} from "./types";

export interface AIImageStudioVariationItem {
  imageUrl: string;
  messageId: string;
  prompt: string;
}

interface AIImageStudioImageActionButtonsProps {
  generatedAt: Date;
  image: AIImageStudioImageResult;
  onRegenerate?: () => void;
  onUseImage?: () => void | Promise<void>;
  prompt: string;
  tone?: "dark" | "default";
}

interface AIImageStudioImageResultCardProps {
  activeVariationMessageId?: string;
  aspectRatio?: AIImageStudioAspectRatio;
  generatedAt: Date;
  image: AIImageStudioImageResult;
  isHighlighted?: boolean;
  isHistorical?: boolean;
  onPreview: () => void;
  onRegenerate?: () => void;
  onUseImage?: () => void | Promise<void>;
  onVariationSelect?: (messageId: string) => void;
  promptForAlt?: string;
  promptForDetails: string;
  showVariationStrip?: boolean;
  stylePreset?: AIImageStudioStylePreset;
  variationGroup?: AIImageStudioVariationItem[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function buildDownloadFilename(prompt: string) {
  const promptSlug = slugify(prompt) || "ai-generated-image";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  return `${promptSlug}-${timestamp}.png`;
}

async function downloadImageAsset(imageUrl: string, prompt: string) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = buildDownloadFilename(prompt);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

function formatStylePreset(stylePreset?: AIImageStudioStylePreset) {
  if (!stylePreset) {
    return null;
  }

  return stylePreset.charAt(0).toUpperCase() + stylePreset.slice(1);
}

export function AIImageStudioImageActionButtons({
  generatedAt: _generatedAt,
  image,
  onUseImage,
  prompt,
  tone = "default",
}: AIImageStudioImageActionButtonsProps) {
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const [usePending, setUsePending] = React.useState(false);

  const handleDownload = React.useCallback(async () => {
    try {
      await downloadImageAsset(image.imageUrl, prompt);
    } catch (error) {
      console.error("Failed to download AI image:", error);
      toast.error("Couldn’t download the image. Try again.");
    }
  }, [image.imageUrl, prompt]);

  const handleUseImage = React.useCallback(async () => {
    if (!onUseImage) {
      return;
    }

    setUsePending(true);

    try {
      await onUseImage();
    } finally {
      setUsePending(false);
    }
  }, [onUseImage]);

  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      justifyContent={tone === "dark" ? "center" : "flex-end"}
      sx={{ minHeight: isMobile ? 44 : 36 }}
    >
      <Tooltip title="Download">
        <IconButton
          aria-label="Download"
          color="neutral"
          onClick={() => {
            void handleDownload();
          }}
          size="sm"
          sx={{
            minHeight: isMobile ? 44 : undefined,
            minWidth: isMobile ? 44 : undefined,
            backgroundColor:
              tone === "dark" ? "rgba(255,255,255,0.08)" : undefined,
            color: tone === "dark" ? "common.white" : undefined,
          }}
          variant={tone === "dark" ? "soft" : "soft"}
        >
          <Download size={16} strokeWidth={2.1} />
        </IconButton>
      </Tooltip>
      <Button
        color="primary"
        loading={usePending}
        onClick={() => {
          void handleUseImage();
        }}
        size="sm"
        startDecorator={<Check size={14} strokeWidth={2.2} />}
        sx={{
          minHeight: isMobile ? 44 : undefined,
          ...(tone === "dark"
            ? {
                bgcolor: "var(--joy-palette-brandNavy-solidBg)",
                "&:hover": {
                  bgcolor: "var(--joy-palette-brandNavy-solidHoverBg)",
                },
              }
            : null),
        }}
        variant="solid"
      >
        Use
      </Button>
    </Stack>
  );
}

function resolveAspectRatioValue(
  image: AIImageStudioImageResult,
  aspectRatio?: AIImageStudioAspectRatio,
) {
  if (image.dimensions?.width && image.dimensions?.height) {
    return `${image.dimensions.width} / ${image.dimensions.height}`;
  }

  switch (aspectRatio) {
    case "16:9":
      return "16 / 9";
    case "9:16":
      return "9 / 16";
    case "1:1":
    default:
      return "1 / 1";
  }
}

const thinScrollbarSx = {
  scrollbarWidth: "thin",
  scrollbarColor: "var(--joy-palette-neutral-outlinedBorder) transparent",
  "&::-webkit-scrollbar": {
    width: "5px",
    height: "5px",
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.4)",
    borderRadius: "10px",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.7)",
  },
} as const;

export function AIImageStudioImageResultCard({
  activeVariationMessageId,
  aspectRatio,
  generatedAt,
  image,
  isHighlighted = false,
  isHistorical = false,
  onPreview,
  onUseImage,
  onVariationSelect,
  promptForAlt,
  promptForDetails,
  showVariationStrip = false,
  stylePreset,
  variationGroup,
}: AIImageStudioImageResultCardProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const canHover = useMediaQuery("(hover: hover)");
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const [naturalDimensions, setNaturalDimensions] = React.useState<{
    height: number;
    width: number;
  } | null>(image.dimensions ?? null);
  const [usePending, setUsePending] = React.useState(false);
  const formattedStylePreset = formatStylePreset(stylePreset);
  const resolvedDimensions = image.dimensions || naturalDimensions;
  const hasVariations = showVariationStrip && (variationGroup?.length || 0) > 1;
  const ratio = resolveAspectRatioValue(image, aspectRatio);

  React.useEffect(() => {
    setImageLoaded(false);
    setLoadFailed(false);
  }, [image.id, image.imageUrl]);

  const handleDownload = React.useCallback(async () => {
    try {
      await downloadImageAsset(
        image.imageUrl,
        promptForAlt || promptForDetails,
      );
    } catch (error) {
      console.error("Failed to download AI image:", error);
      toast.error("Couldn’t download the image. Try again.");
    }
  }, [image.imageUrl, promptForAlt, promptForDetails]);

  const handleUseImage = React.useCallback(async () => {
    if (!onUseImage) {
      return;
    }

    setUsePending(true);

    try {
      await onUseImage();
    } finally {
      setUsePending(false);
    }
  }, [onUseImage]);

  return (
    <Stack spacing={0.875}>
      <Box
        sx={{
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: "background.level1",
          boxShadow: "sm",
          border: "1px solid",
          borderColor: isHighlighted ? "primary.400" : "divider",
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            display: "block",
            "&:hover .aiImageStudioCardOverlay": canHover
              ? {
                  opacity: 1,
                }
              : undefined,
            "&:hover .aiImageStudioCardActions": canHover
              ? {
                  opacity: 1,
                  transform: "translateY(0)",
                }
              : undefined,
          }}
        >
          <Box sx={{ position: "relative", width: "100%", aspectRatio: ratio }}>
            <Box
              component="button"
              onClick={onPreview}
              type="button"
              sx={{
                position: "absolute",
                inset: 0,
                border: "none",
                p: 0,
                m: 0,
                backgroundColor: "transparent",
                cursor: "zoom-in",
                zIndex: 0,
                "&:focus-visible": {
                  outline: "2px solid var(--joy-palette-primary-300)",
                  outlineOffset: -2,
                },
              }}
            />

            {!imageLoaded && !loadFailed ? (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "background.level1",
                  transition: "opacity 200ms ease",
                  opacity: imageLoaded ? 0 : 1,
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              >
                <CircularProgress
                  color="primary"
                  size="md"
                  thickness={3}
                  variant="soft"
                />
              </Box>
            ) : null}

            {loadFailed ? (
              <Stack
                spacing={1}
                alignItems="center"
                justifyContent="center"
                sx={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "background.level1",
                  color: "text.tertiary",
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              >
                <ImageOff size={32} strokeWidth={1.8} />
                <Typography level="body-xs" textColor="text.tertiary">
                  Image failed to load
                </Typography>
              </Stack>
            ) : null}

            <Box
              component="img"
              alt={promptForAlt || "AI generated image."}
              loading="lazy"
              onError={() => {
                setLoadFailed(true);
                setImageLoaded(false);
              }}
              onLoad={(event: React.SyntheticEvent<HTMLImageElement>) => {
                const target = event.currentTarget;

                if (target.naturalWidth && target.naturalHeight) {
                  setNaturalDimensions({
                    width: target.naturalWidth,
                    height: target.naturalHeight,
                  });
                }

                setLoadFailed(false);
                setImageLoaded(true);
              }}
              src={image.imageUrl}
              sx={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: isHistorical ? "contain" : "cover",
                position: "relative",
                zIndex: 1,
                opacity: imageLoaded ? 1 : 0,
                transform: imageLoaded ? "scale(1)" : "scale(0.98)",
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity 400ms ease, transform 400ms ease",
                pointerEvents: "none",
              }}
            />

            {!isMobile ? (
              <>
                <Box
                  className="aiImageStudioCardOverlay"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    transition: prefersReducedMotion
                      ? "none"
                      : "opacity 200ms ease",
                    background:
                      "linear-gradient(transparent 60%, rgba(0,0,0,0.35) 100%)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
                <Stack
                  className="aiImageStudioCardActions"
                  direction="row"
                  spacing={0.75}
                  sx={{
                    position: "absolute",
                    right: 10,
                    bottom: 10,
                    opacity: 0,
                    transform: "translateY(6px)",
                    transition: prefersReducedMotion
                      ? "none"
                      : "opacity 150ms ease, transform 150ms ease",
                    zIndex: 3,
                  }}
                >
                  <Tooltip title="Download">
                    <IconButton
                      aria-label="Download"
                      color="neutral"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDownload();
                      }}
                      size="sm"
                      variant="soft"
                    >
                      <Download size={16} strokeWidth={2.1} />
                    </IconButton>
                  </Tooltip>
                  <Button
                    color="primary"
                    loading={usePending}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleUseImage();
                    }}
                    size="sm"
                    startDecorator={<Check size={14} strokeWidth={2.2} />}
                    variant="solid"
                  >
                    Use
                  </Button>
                </Stack>
              </>
            ) : null}
          </Box>
        </Box>

        {isMobile ? (
          <Stack
            direction="row"
            spacing={1}
            justifyContent="flex-end"
            sx={{ px: 1, py: 1, backgroundColor: "background.surface" }}
          >
            <IconButton
              aria-label="Download"
              color="neutral"
              onClick={() => {
                void handleDownload();
              }}
              size="sm"
              sx={{ minHeight: 44, minWidth: 44 }}
              variant="soft"
            >
              <Download size={16} strokeWidth={2.1} />
            </IconButton>
            <Button
              color="primary"
              loading={usePending}
              onClick={() => {
                void handleUseImage();
              }}
              size="sm"
              startDecorator={<Check size={14} strokeWidth={2.2} />}
              sx={{ minHeight: 44 }}
              variant="solid"
            >
              Use
            </Button>
          </Stack>
        ) : null}
      </Box>

      <Box>
        <Link
          color="neutral"
          component="button"
          onClick={() => setDetailsOpen((currentOpen) => !currentOpen)}
          sx={{
            typography: "body-xs",
            textDecoration: "none",
            cursor: "pointer",
            color: "text.tertiary",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
          }}
          underline="none"
        >
          <ChevronRight
            size={12}
            strokeWidth={2.1}
            style={{
              transform: detailsOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          />
          Details
        </Link>

        <Box
          sx={{
            overflow: "hidden",
            maxHeight: detailsOpen ? 240 : 0,
            opacity: detailsOpen ? 1 : 0,
            transition:
              "max-height 200ms ease, opacity 200ms ease, transform 200ms ease",
            transform: detailsOpen ? "translateY(0)" : "translateY(-4px)",
          }}
        >
          <Stack
            spacing={1}
            sx={{
              pt: 0.875,
              pl: "12px",
              borderLeft: "2px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              level="body-xs"
              textColor="text.tertiary"
              sx={{ whiteSpace: "pre-wrap" }}
            >
              <Typography
                component="span"
                level="body-xs"
                fontWeight="md"
                textColor="text.primary"
              >
                Prompt:
              </Typography>{" "}
              {promptForDetails}
            </Typography>

            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {formattedStylePreset ? (
                <Chip size="sm" variant="outlined">
                  {formattedStylePreset}
                </Chip>
              ) : null}

              <Typography level="body-xs" textColor="text.tertiary">
                Dimensions:{" "}
                {resolvedDimensions
                  ? `${resolvedDimensions.width} × ${resolvedDimensions.height}`
                  : "Loading…"}
              </Typography>

              <Typography level="body-xs" textColor="text.tertiary">
                Generated:{" "}
                {formatDistanceToNow(generatedAt, { addSuffix: true })}
              </Typography>
            </Stack>

            {image.tags && image.tags.length > 0 ? (
              <Stack
                direction="row"
                spacing={0.5}
                useFlexGap
                sx={{ flexWrap: "wrap" }}
              >
                {image.tags.map((tag) => (
                  <Chip
                    key={`${image.id}-${tag.category || "tag"}-${tag.name}`}
                    color="neutral"
                    size="sm"
                    variant="soft"
                  >
                    {tag.name}
                  </Chip>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Box>
      </Box>

      {hasVariations ? (
        <Box
          sx={{
            backgroundColor: "background.level2",
            borderRadius: "8px",
            p: 1,
          }}
        >
          <Typography
            level="body-xs"
            textColor="text.tertiary"
            sx={{ mb: 0.75 }}
          >
            Variations
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ overflowX: "auto", ...thinScrollbarSx }}
          >
            {variationGroup?.map((variation) => (
              <Box
                key={`${variation.messageId}-${variation.imageUrl}`}
                component="button"
                onClick={() => onVariationSelect?.(variation.messageId)}
                type="button"
                sx={{
                  height: isHistorical ? 64 : 80,
                  width: isHistorical ? 64 : 80,
                  borderRadius: "6px",
                  overflow: "hidden",
                  border: "2px solid",
                  borderColor:
                    activeVariationMessageId === variation.messageId
                      ? "primary.500"
                      : "rgba(var(--joy-palette-neutral-mainChannel) / 0.18)",
                  backgroundColor: "background.surface",
                  p: 0,
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                <Box
                  component="img"
                  alt={variation.prompt || "AI generated image."}
                  loading="lazy"
                  src={variation.imageUrl}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
