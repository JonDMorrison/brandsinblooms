import React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { format, formatDistanceToNow } from "date-fns";
import {
  Check,
  CheckCheck,
  Copy,
  Download,
  RefreshCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type {
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
  const timestamp = format(new Date(), "yyyyMMdd-HHmm");
  return `${promptSlug}-${timestamp}.png`;
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
  onRegenerate,
  onUseImage,
  prompt,
  tone = "default",
}: AIImageStudioImageActionButtonsProps) {
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const actionSize = isMobile ? "md" : "sm";
  const minimumTapTarget = isMobile ? 44 : 36;
  const [copied, setCopied] = React.useState(false);
  const [useConfirmed, setUseConfirmed] = React.useState(false);

  React.useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  React.useEffect(() => {
    if (!useConfirmed) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUseConfirmed(false);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [useConfirmed]);

  const handleDownload = React.useCallback(async () => {
    try {
      const response = await fetch(image.imageUrl);

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
    } catch (error) {
      console.error("Failed to download AI image:", error);
      toast.error("Couldn’t download the image. Try again.");
    }
  }, [image.imageUrl, prompt]);

  const handleCopy = React.useCallback(async () => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      toast.error("Clipboard access denied. Try downloading instead.");
      return;
    }

    try {
      const response = await fetch(image.imageUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || image.mimeType || "image/png"]: blob,
        }),
      ]);
      setCopied(true);
    } catch (error) {
      console.error("Failed to copy AI image to clipboard:", error);
      toast.error("Clipboard access denied. Try downloading instead.");
    }
  }, [image.imageUrl, image.mimeType]);

  const handleUseImage = React.useCallback(async () => {
    setUseConfirmed(true);
    await onUseImage?.();
  }, [onUseImage]);

  const actionButtonSx =
    tone === "dark"
      ? {
          minWidth: minimumTapTarget,
          minHeight: minimumTapTarget,
          borderColor: "rgba(255,255,255,0.26)",
          color: "rgba(255,255,255,0.9)",
          backgroundColor: "rgba(255,255,255,0.04)",
          "&:hover": {
            backgroundColor: "rgba(255,255,255,0.08)",
            borderColor: "rgba(255,255,255,0.38)",
          },
        }
      : {
          minWidth: minimumTapTarget,
          minHeight: minimumTapTarget,
        };

  const iconAnimationSx = {
    transition: "transform 200ms ease, opacity 200ms ease",
    transform: copied || useConfirmed ? "scale(1.08)" : "scale(1)",
  } as const;

  return (
    <Stack
      direction="row"
      spacing={0.5}
      alignItems="center"
      justifyContent={tone === "dark" ? "center" : "flex-start"}
      sx={{
        minHeight: isMobile ? 44 : 36,
        flexWrap: tone === "dark" ? "wrap" : "nowrap",
      }}
    >
      <Tooltip title={useConfirmed ? "Selected" : "Use This Image"}>
        <IconButton
          aria-label="Use this image"
          color={tone === "dark" ? "neutral" : "primary"}
          onClick={() => {
            void handleUseImage();
          }}
          size={actionSize}
          sx={actionButtonSx}
          variant={tone === "dark" ? "outlined" : "soft"}
        >
          <Box sx={iconAnimationSx}>
            {useConfirmed ? (
              <CheckCheck size={16} strokeWidth={2.2} />
            ) : (
              <Check size={16} strokeWidth={2.2} />
            )}
          </Box>
        </IconButton>
      </Tooltip>

      <Tooltip title="Download">
        <IconButton
          aria-label="Download image"
          color="neutral"
          onClick={() => {
            void handleDownload();
          }}
          size={actionSize}
          sx={actionButtonSx}
          variant={tone === "dark" ? "outlined" : "plain"}
        >
          <Download size={16} strokeWidth={2.1} />
        </IconButton>
      </Tooltip>

      <Tooltip title="Regenerate">
        <IconButton
          aria-label="Regenerate image"
          color="neutral"
          onClick={onRegenerate}
          size={actionSize}
          sx={actionButtonSx}
          variant={tone === "dark" ? "outlined" : "plain"}
        >
          <RefreshCcw size={16} strokeWidth={2.1} />
        </IconButton>
      </Tooltip>

      <Tooltip
        open={copied ? true : undefined}
        title={copied ? "Copied!" : "Copy to Clipboard"}
      >
        <IconButton
          aria-label="Copy image to clipboard"
          color="neutral"
          onClick={() => {
            void handleCopy();
          }}
          size={actionSize}
          sx={actionButtonSx}
          variant={tone === "dark" ? "outlined" : "plain"}
        >
          <Box sx={iconAnimationSx}>
            {copied ? (
              <Check size={16} strokeWidth={2.2} />
            ) : (
              <Copy size={16} strokeWidth={2.1} />
            )}
          </Box>
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

export function AIImageStudioImageResultCard({
  activeVariationMessageId,
  generatedAt,
  image,
  isHighlighted = false,
  isHistorical = false,
  onPreview,
  onRegenerate,
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
  const [showBurst, setShowBurst] = React.useState(false);
  const canHover = useMediaQuery("(hover: hover)");
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const [naturalDimensions, setNaturalDimensions] = React.useState<{
    height: number;
    width: number;
  } | null>(image.dimensions ?? null);
  const formattedStylePreset = formatStylePreset(stylePreset);
  const resolvedDimensions = image.dimensions || naturalDimensions;
  const hasVariations = showVariationStrip && (variationGroup?.length || 0) > 1;
  const hideActionsUntilHover = isHistorical && canHover;

  React.useEffect(() => {
    setImageLoaded(false);
    setShowBurst(false);
  }, [image.id, image.imageUrl]);

  React.useEffect(() => {
    if (!showBurst) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowBurst(false);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showBurst]);

  return (
    <Stack spacing={0.75}>
      <Box
        sx={{
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid",
          borderColor: isHighlighted ? "primary.400" : "divider",
          backgroundColor: "background.level1",
          animation:
            isHighlighted && !prefersReducedMotion
              ? "aiImageStudioVariationPulse 300ms ease-out"
              : "none",
          "&:hover .aiImageStudioActionBar, &:focus-within .aiImageStudioActionBar":
            hideActionsUntilHover
              ? {
                  opacity: 1,
                  visibility: "visible",
                  transform: "translateY(0)",
                }
              : {},
          "@keyframes aiImageStudioVariationPulse": {
            from: {
              boxShadow:
                "0 0 0 0 rgba(var(--joy-palette-primary-mainChannel) / 0.24)",
            },
            to: {
              boxShadow:
                "0 0 0 8px rgba(var(--joy-palette-primary-mainChannel) / 0)",
            },
          },
        }}
      >
        <Box
          component="button"
          onClick={onPreview}
          type="button"
          sx={{
            position: "relative",
            width: "100%",
            border: "none",
            p: 0,
            m: 0,
            backgroundColor: "background.level2",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "zoom-in",
            overflow: "hidden",
            "&:hover .aiImageStudioPreviewOverlay": {
              opacity: 1,
            },
            "&:focus-visible": {
              outline:
                "2px solid rgba(var(--joy-palette-primary-mainChannel) / 0.32)",
              outlineOffset: -2,
            },
          }}
        >
          {!imageLoaded ? (
            <Box
              aria-hidden="true"
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(115deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 10%, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 35%, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 60%)",
                backgroundSize: "200% 100%",
                animation: prefersReducedMotion
                  ? "none"
                  : "aiImageStudioCardShimmer 1.4s linear infinite",
                "@keyframes aiImageStudioCardShimmer": {
                  from: {
                    backgroundPosition: "200% 0",
                  },
                  to: {
                    backgroundPosition: "-200% 0",
                  },
                },
              }}
            />
          ) : null}

          <Box
            component="img"
            alt={promptForAlt || "AI generated image."}
            onLoad={(event: React.SyntheticEvent<HTMLImageElement>) => {
              const target = event.currentTarget;

              if (target.naturalWidth && target.naturalHeight) {
                setNaturalDimensions({
                  width: target.naturalWidth,
                  height: target.naturalHeight,
                });
              }

              setImageLoaded(true);
              setShowBurst(!prefersReducedMotion);
            }}
            src={image.imageUrl}
            sx={{
              display: "block",
              width: "auto",
              maxWidth: "100%",
              height: "auto",
              maxHeight: isHistorical ? 240 : 360,
              objectFit: "contain",
              opacity: imageLoaded ? 1 : 0,
              transform: imageLoaded ? "scale(1)" : "scale(0.97)",
              transition: prefersReducedMotion
                ? "none"
                : "opacity 600ms ease, transform 600ms ease",
            }}
            loading="lazy"
          />

          {showBurst && !prefersReducedMotion ? (
            <Box
              aria-hidden="true"
              sx={{
                position: "absolute",
                inset: -24,
                pointerEvents: "none",
                background:
                  "radial-gradient(circle, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.03) 24%, rgba(var(--joy-palette-primary-mainChannel) / 0) 70%)",
                animation: "aiImageStudioCardBurst 400ms ease-out forwards",
                "@keyframes aiImageStudioCardBurst": {
                  from: {
                    opacity: 0,
                    transform: "scale(0.84)",
                  },
                  to: {
                    opacity: 1,
                    transform: "scale(1.12)",
                  },
                },
              }}
            />
          ) : null}

          <Box
            className="aiImageStudioPreviewOverlay"
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              transition: prefersReducedMotion ? "none" : "opacity 200ms ease",
              background:
                "linear-gradient(transparent 50%, rgba(0,0,0,0.4) 100%)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              pb: 1.5,
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: "999px",
                backgroundColor: "rgba(255,255,255,0.14)",
                color: "common.white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(10px)",
              }}
            >
              <Search size={15} strokeWidth={2.2} />
            </Box>
          </Box>
        </Box>

        <Box
          className="aiImageStudioActionBar"
          sx={{
            borderTop: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.level1",
            px: 0.5,
            py: 0.25,
            opacity: hideActionsUntilHover ? 0 : 1,
            visibility: hideActionsUntilHover ? "hidden" : "visible",
            transform: hideActionsUntilHover
              ? "translateY(6px)"
              : "translateY(0)",
            transition: prefersReducedMotion
              ? "none"
              : "opacity 180ms ease, transform 180ms ease, visibility 180ms ease",
          }}
        >
          <AIImageStudioImageActionButtons
            generatedAt={generatedAt}
            image={image}
            onRegenerate={onRegenerate}
            onUseImage={onUseImage}
            prompt={promptForAlt || promptForDetails}
          />
        </Box>
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
          }}
          underline="none"
        >
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
          <Stack spacing={1} sx={{ pt: 0.75 }}>
            <Typography
              level="body-xs"
              textColor="text.secondary"
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
            sx={{
              overflowX: "auto",
              scrollbarWidth: "thin",
              "&::-webkit-scrollbar": {
                height: 6,
              },
            }}
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
