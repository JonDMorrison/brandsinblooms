import React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ArrowUp, SlidersHorizontal, Sparkles, Square } from "lucide-react";
import type {
  AIImageStudioAspectRatio,
  AIImageStudioColorPalette,
  AIImageStudioGenerationConfig,
  AIImageStudioMood,
  AIImageStudioQuality,
  AIImageStudioStylePreset,
} from "./types";

interface AIImageStudioInputAreaProps {
  footerMaxHeight?: number | null;
  generationConfig: AIImageStudioGenerationConfig;
  inputPrompt: string;
  isEnhancing: boolean;
  isProcessing: boolean;
  isSettingsOpen: boolean;
  onConfigChange: (config: AIImageStudioGenerationConfig) => void;
  onEnhancePrompt: () => void;
  onInputChange: (value: string) => void;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onStopGeneration: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onToggleSettings: () => void;
  onUseImage: () => Promise<void>;
  paddingX: number;
  promptInputRef: React.RefObject<HTMLTextAreaElement | null>;
  recommendedAspectRatio?: AIImageStudioAspectRatio | null;
  selectionConfirmation?: {
    blockLabel: string;
    icon?: React.ReactNode;
  } | null;
  selectedImage: string | null;
}

const aspectRatioOptions: Array<{
  label: string;
  ratio: string;
  shapeHeight: number;
  shapeWidth: number;
  value: AIImageStudioAspectRatio;
}> = [
  {
    value: "1:1",
    label: "Square",
    ratio: "1:1",
    shapeWidth: 20,
    shapeHeight: 20,
  },
  {
    value: "16:9",
    label: "Landscape",
    ratio: "16:9",
    shapeWidth: 28,
    shapeHeight: 16,
  },
  {
    value: "9:16",
    label: "Portrait",
    ratio: "9:16",
    shapeWidth: 16,
    shapeHeight: 28,
  },
];

const stylePresetOptions: Array<{
  label: string;
  value: AIImageStudioStylePreset;
}> = [
  { label: "Photographic", value: "photographic" },
  { label: "Illustration", value: "illustration" },
  { label: "Watercolor", value: "watercolor" },
  { label: "Minimalist", value: "minimalist" },
  { label: "Cinematic", value: "cinematic" },
];

const qualityOptions: Array<{ label: string; value: AIImageStudioQuality }> = [
  { label: "Standard", value: "standard" },
  { label: "HD", value: "hd" },
];

const moodOptions: Array<{ label: string; value: AIImageStudioMood }> = [
  { label: "Natural", value: "natural" },
  { label: "Warm", value: "warm" },
  { label: "Cool", value: "cool" },
  { label: "Dramatic", value: "dramatic" },
  { label: "Soft", value: "soft" },
  { label: "Vibrant", value: "vibrant" },
];

const paletteOptions: Array<{
  color: string;
  label: string;
  value: AIImageStudioColorPalette;
}> = [
  {
    value: "auto",
    label: "Auto",
    color:
      "linear-gradient(135deg, #8B7355 0%, #4CAF50 30%, #FFB6C1 65%, #333333 100%)",
  },
  { value: "earth-tones", label: "Earth Tones", color: "#8B7355" },
  { value: "fresh-greens", label: "Fresh Greens", color: "#4CAF50" },
  { value: "soft-pastels", label: "Soft Pastels", color: "#FFB6C1" },
  { value: "monochrome", label: "Monochrome", color: "#333333" },
];

const defaultGenerationConfig: AIImageStudioGenerationConfig = {
  aspectRatio: "1:1",
  colorPalette: "auto",
  mood: "natural",
  quality: "standard",
  stylePreset: "photographic",
};

const sectionLabelSx = {
  mb: "8px",
  color: "text.tertiary",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const;

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

function StudioSectionLabel({ children }: { children: React.ReactNode }) {
  return <Typography sx={sectionLabelSx}>{children}</Typography>;
}

export function AIImageStudioInputArea({
  footerMaxHeight,
  generationConfig,
  inputPrompt,
  isEnhancing,
  isProcessing,
  isSettingsOpen,
  onConfigChange,
  onEnhancePrompt,
  onInputChange,
  onKeyDown,
  onStopGeneration,
  onSubmit,
  onToggleSettings,
  onUseImage,
  paddingX,
  promptInputRef,
  recommendedAspectRatio,
  selectionConfirmation,
  selectedImage,
}: AIImageStudioInputAreaProps) {
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const hasPrompt = inputPrompt.trim().length > 0;
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const footerReservedHeight = React.useMemo(() => {
    let reservedHeight = isMobile ? 184 : 156;

    if (selectionConfirmation || selectedImage) {
      reservedHeight += isMobile ? 84 : 72;
    }

    return reservedHeight;
  }, [isMobile, selectedImage, selectionConfirmation]);
  const settingsPanelMaxHeight = React.useMemo(() => {
    if (typeof footerMaxHeight !== "number") {
      return 240;
    }

    return Math.max(120, Math.min(240, footerMaxHeight - footerReservedHeight));
  }, [footerMaxHeight, footerReservedHeight]);

  const setAspectRatio = React.useCallback(
    (aspectRatio: AIImageStudioAspectRatio) => {
      onConfigChange({ ...generationConfig, aspectRatio });
    },
    [generationConfig, onConfigChange],
  );

  const setStylePreset = React.useCallback(
    (stylePreset: AIImageStudioStylePreset) => {
      onConfigChange({ ...generationConfig, stylePreset });
    },
    [generationConfig, onConfigChange],
  );

  const setQuality = React.useCallback(
    (quality: AIImageStudioQuality) => {
      onConfigChange({ ...generationConfig, quality });
    },
    [generationConfig, onConfigChange],
  );

  const setMood = React.useCallback(
    (mood: AIImageStudioMood) => {
      onConfigChange({ ...generationConfig, mood });
    },
    [generationConfig, onConfigChange],
  );

  const setColorPalette = React.useCallback(
    (colorPalette: AIImageStudioColorPalette) => {
      onConfigChange({ ...generationConfig, colorPalette });
    },
    [generationConfig, onConfigChange],
  );

  const resetDefaults = React.useCallback(() => {
    onConfigChange(defaultGenerationConfig);
  }, [onConfigChange]);

  const selectedPalette =
    paletteOptions.find(
      (option) => option.value === generationConfig.colorPalette,
    ) || paletteOptions[0];

  const handleSendAction = React.useCallback(() => {
    if (isProcessing) {
      onStopGeneration();
      return;
    }

    if (!hasPrompt) {
      return;
    }

    formRef.current?.requestSubmit();
  }, [hasPrompt, isProcessing, onStopGeneration]);

  return (
    <Box
      component="footer"
      sx={{
        px: paddingX,
        pt: 0,
        pb: isMobile ? "calc(16px + env(safe-area-inset-bottom, 0px))" : 2,
        backgroundColor: "background.surface",
        borderTop: "1px solid",
        borderColor: "divider",
        boxShadow: isSettingsOpen
          ? "0 -4px 12px -4px rgba(0,0,0,0.08)"
          : "none",
        position: "sticky",
        bottom: 0,
        zIndex: 2,
        flexShrink: 0,
        maxHeight: footerMaxHeight ? `${footerMaxHeight}px` : undefined,
        minHeight: 0,
        overflow: "hidden",
        transition: "box-shadow 200ms ease",
      }}
    >
      <Stack spacing={1.5} sx={{ minHeight: 0 }}>
        <Box
          aria-hidden={!isSettingsOpen}
          sx={{
            overflow: "hidden",
            maxHeight: isSettingsOpen ? `${settingsPanelMaxHeight}px` : "0px",
            opacity: isSettingsOpen ? 1 : 0,
            pointerEvents: isSettingsOpen ? "auto" : "none",
            transition: isSettingsOpen
              ? "max-height 250ms ease-out, opacity 250ms ease-out"
              : "max-height 200ms ease-in, opacity 200ms ease-in",
          }}
        >
          <Stack
            spacing={2}
            sx={{
              maxHeight: `${settingsPanelMaxHeight}px`,
              overflowY: "auto",
              backgroundColor: "background.surface",
              px: 2.5,
              py: 2,
              overscrollBehaviorY: "contain",
              WebkitOverflowScrolling: "touch",
              ...thinScrollbarSx,
            }}
          >
            <Box>
              <StudioSectionLabel>Aspect Ratio</StudioSectionLabel>
              <Stack direction="row" spacing={1} justifyContent="space-between">
                {aspectRatioOptions.map((option) => {
                  const isSelected =
                    generationConfig.aspectRatio === option.value;
                  const isRecommended = recommendedAspectRatio === option.value;

                  return (
                    <Stack
                      key={option.value}
                      spacing={0.625}
                      sx={{ flex: 1, minWidth: 0, alignItems: "center" }}
                    >
                      <Box
                        component="button"
                        onClick={() => setAspectRatio(option.value)}
                        type="button"
                        sx={{
                          position: "relative",
                          width: "100%",
                          maxWidth: 56,
                          height: 48,
                          borderRadius: "10px",
                          border: "1.5px solid",
                          borderColor: isSelected
                            ? "primary.outlinedBorder"
                            : "divider",
                          bgcolor: isSelected
                            ? "primary.50"
                            : "background.level1",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s ease",
                          boxShadow: isSelected
                            ? "0 0 0 1px var(--joy-palette-primary-outlinedBorder)"
                            : "none",
                          "&:hover": {
                            borderColor: isSelected
                              ? "primary.outlinedBorder"
                              : "neutral.outlinedHoverBorder",
                            bgcolor: isSelected
                              ? "primary.50"
                              : "background.level2",
                          },
                          "&:focus-visible": {
                            outline: "2px solid var(--joy-palette-primary-300)",
                            outlineOffset: 2,
                          },
                        }}
                      >
                        {isRecommended ? (
                          <Box
                            sx={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              px: 0.5,
                              py: 0.125,
                              borderRadius: "3px",
                              bgcolor: "var(--joy-palette-brandNavy-500)",
                              color: "common.white",
                              fontSize: "4px",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                            }}
                          >
                            REC
                          </Box>
                        ) : null}
                        <Box
                          sx={{
                            width: option.shapeWidth,
                            height: option.shapeHeight,
                            borderRadius: "4px",
                            border: "1.5px solid",
                            borderColor: isSelected
                              ? "var(--joy-palette-brandNavy-500)"
                              : "neutral.outlinedBorder",
                          }}
                        />
                      </Box>
                      <Typography level="body-xs" textColor="text.secondary">
                        {option.ratio}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>

            <Box>
              <StudioSectionLabel>Style</StudioSectionLabel>
              <Stack
                direction="row"
                spacing={1}
                sx={{ overflowX: "auto", pb: 0.25, ...thinScrollbarSx }}
              >
                {stylePresetOptions.map((option) => {
                  const isSelected =
                    generationConfig.stylePreset === option.value;

                  return (
                    <Chip
                      key={option.value}
                      color={isSelected ? "primary" : "neutral"}
                      onClick={() => setStylePreset(option.value)}
                      size="sm"
                      sx={{
                        borderRadius: "8px",
                        px: "12px",
                        cursor: "pointer",
                        minHeight: isMobile ? 44 : undefined,
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                        "&:hover": isSelected
                          ? undefined
                          : {
                              bgcolor: "background.level2",
                              borderColor: "neutral.outlinedHoverBorder",
                            },
                      }}
                      variant={isSelected ? "solid" : "outlined"}
                    >
                      {option.label}
                    </Chip>
                  );
                })}
              </Stack>
            </Box>

            <Box>
              <StudioSectionLabel>Quality</StudioSectionLabel>
              <Box
                sx={{
                  display: "inline-flex",
                  bgcolor: "background.level1",
                  borderRadius: "8px",
                  p: "3px",
                  gap: "3px",
                }}
              >
                {qualityOptions.map((option) => {
                  const isSelected = generationConfig.quality === option.value;

                  return (
                    <Button
                      key={option.value}
                      color="neutral"
                      onClick={() => setQuality(option.value)}
                      sx={{
                        px: "16px",
                        py: "5px",
                        minHeight: isMobile ? 44 : 32,
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 500,
                        bgcolor: isSelected
                          ? "background.surface"
                          : "transparent",
                        color: isSelected ? "text.primary" : "text.secondary",
                        boxShadow: isSelected ? "sm" : "none",
                        border: "none",
                      }}
                      variant="plain"
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </Box>
            </Box>

            <Box>
              <StudioSectionLabel>Mood</StudioSectionLabel>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {moodOptions.map((option) => {
                  const isSelected = generationConfig.mood === option.value;

                  return (
                    <Chip
                      key={option.value}
                      color={isSelected ? "primary" : "neutral"}
                      onClick={() => setMood(option.value)}
                      size="sm"
                      sx={{
                        borderRadius: "8px",
                        cursor: "pointer",
                        minHeight: isMobile ? 44 : undefined,
                        transition: "all 0.2s ease",
                        "&:hover": isSelected
                          ? undefined
                          : {
                              bgcolor: "background.level2",
                              borderColor: "neutral.outlinedHoverBorder",
                            },
                      }}
                      variant={isSelected ? "solid" : "outlined"}
                    >
                      {option.label}
                    </Chip>
                  );
                })}
              </Stack>
            </Box>

            <Box>
              <StudioSectionLabel>Color Palette</StudioSectionLabel>
              <Stack spacing={0.875}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {paletteOptions.map((option) => {
                    const isSelected =
                      generationConfig.colorPalette === option.value;

                    return (
                      <Box
                        key={option.value}
                        component="button"
                        onClick={() => setColorPalette(option.value)}
                        type="button"
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: "none",
                          background: option.color,
                          cursor: "pointer",
                          flexShrink: 0,
                          boxShadow: isSelected
                            ? "0 0 0 3px var(--joy-palette-background-surface), 0 0 0 5px var(--joy-palette-primary-500)"
                            : "0 0 0 1px rgba(var(--joy-palette-neutral-mainChannel) / 0.14)",
                          "&:focus-visible": {
                            outline: "2px solid var(--joy-palette-primary-300)",
                            outlineOffset: 3,
                          },
                        }}
                      />
                    );
                  })}
                </Stack>
                <Typography level="body-xs" textColor="text.tertiary">
                  {selectedPalette.label}
                </Typography>
              </Stack>
            </Box>

            <Box>
              <Link
                color="neutral"
                component="button"
                level="body-xs"
                onClick={resetDefaults}
                sx={{ textDecoration: "none" }}
                underline="none"
              >
                Reset to defaults
              </Link>
            </Box>
          </Stack>
        </Box>

        {selectionConfirmation ? (
          <Box
            sx={{
              mt: 1.5,
              px: 1.5,
              py: 1.25,
              borderRadius: "lg",
              display: "flex",
              alignItems: "center",
              gap: 1,
              backgroundColor:
                "rgba(var(--joy-palette-primary-mainChannel) / 0.06)",
              border:
                "1px solid rgba(var(--joy-palette-primary-mainChannel) / 0.12)",
            }}
          >
            {selectionConfirmation.icon ? (
              <Box
                aria-hidden="true"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "primary.500",
                  flexShrink: 0,
                }}
              >
                {selectionConfirmation.icon}
              </Box>
            ) : null}
            <Typography level="body-sm" fontWeight="md">
              Added to {selectionConfirmation.blockLabel}
            </Typography>
          </Box>
        ) : selectedImage ? (
          <Box
            sx={{
              mt: 1.5,
              px: 1.5,
              py: 1.25,
              borderRadius: "lg",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              backgroundColor:
                "rgba(var(--joy-palette-primary-mainChannel) / 0.06)",
              border:
                "1px solid rgba(var(--joy-palette-primary-mainChannel) / 0.12)",
            }}
          >
            <Typography level="body-sm" fontWeight="md">
              Image selected!
            </Typography>
            <Button
              color="primary"
              onClick={() => {
                void onUseImage();
              }}
              size="sm"
              sx={{ minHeight: isMobile ? 44 : undefined }}
              variant="solid"
            >
              Use This Image
            </Button>
          </Box>
        ) : null}

        <Box
          component="form"
          onSubmit={onSubmit}
          ref={formRef}
          sx={{ pt: 1.5 }}
        >
          <Stack spacing={1}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                border: "1.5px solid",
                borderColor: "neutral.outlinedBorder",
                borderRadius: "16px",
                bgcolor: "background.surface",
                p: "4px",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                "&:focus-within": {
                  borderColor: "primary.300",
                  boxShadow: "0 0 0 3px var(--joy-palette-primary-100)",
                },
              }}
            >
              <Textarea
                color="neutral"
                disabled={isProcessing}
                maxRows={6}
                minRows={1}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Describe the image you want to create..."
                slotProps={{
                  textarea: {
                    "aria-label": "Describe the image you want to create",
                    ref: promptInputRef,
                    readOnly: isEnhancing,
                  },
                }}
                sx={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  boxShadow: "none",
                  p: "10px 12px",
                  fontSize: "14px",
                  minHeight: "44px",
                  maxHeight: "120px",
                  resize: "none",
                  bgcolor: "transparent",
                  "--Textarea-focusedHighlight": "transparent",
                  "--Textarea-focusedThickness": "0px",
                  "&::before": {
                    display: "none",
                  },
                  "&:focus-within": {
                    boxShadow: "none",
                  },
                  "&:focus-visible": {
                    outline: "none",
                  },
                  "& textarea": {
                    typography: "body-md",
                    color: "text.primary",
                    lineHeight: 1.55,
                    overflowY: "auto",
                    resize: "none",
                  },
                  "& textarea::placeholder": {
                    color: "text.tertiary",
                    opacity: 1,
                  },
                  "&.Mui-disabled": {
                    opacity: 0.64,
                  },
                }}
                value={inputPrompt}
                variant="plain"
              />

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: "8px", pb: "6px", pt: "2px" }}
              >
                <IconButton
                  aria-label={
                    isSettingsOpen
                      ? "Hide generation settings"
                      : "Show generation settings"
                  }
                  color="neutral"
                  onClick={onToggleSettings}
                  size="sm"
                  sx={{
                    borderRadius: "8px",
                    color: isSettingsOpen
                      ? "var(--joy-palette-primary-plainColor)"
                      : "text.tertiary",
                    minWidth: isMobile ? 44 : undefined,
                    minHeight: isMobile ? 44 : undefined,
                    transition:
                      "transform 200ms ease, color 200ms ease, background-color 200ms ease",
                    transform: isSettingsOpen
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    "&:hover": {
                      color: isSettingsOpen
                        ? "var(--joy-palette-primary-plainColor)"
                        : "text.secondary",
                      bgcolor: "background.level1",
                    },
                  }}
                  variant="plain"
                >
                  <SlidersHorizontal size={18} strokeWidth={1.9} />
                </IconButton>

                <IconButton
                  aria-label={
                    isProcessing ? "Stop generation" : "Generate image"
                  }
                  color={
                    isProcessing ? "danger" : hasPrompt ? "primary" : "neutral"
                  }
                  onClick={handleSendAction}
                  size="sm"
                  sx={{
                    width: 32,
                    height: 32,
                    minWidth: isMobile ? 44 : 32,
                    minHeight: isMobile ? 44 : 32,
                    borderRadius: "10px",
                    color:
                      !isProcessing && !hasPrompt ? "text.tertiary" : undefined,
                    cursor: !isProcessing && !hasPrompt ? "default" : "pointer",
                    transition:
                      "background-color 200ms ease, color 200ms ease, box-shadow 200ms ease, transform 200ms ease",
                    boxShadow: !isProcessing && hasPrompt ? "sm" : "none",
                  }}
                  variant={
                    isProcessing ? "soft" : hasPrompt ? "solid" : "plain"
                  }
                >
                  {isProcessing ? (
                    <Square size={18} strokeWidth={2.1} />
                  ) : (
                    <ArrowUp size={18} strokeWidth={2.1} />
                  )}
                </IconButton>
              </Stack>
            </Box>

            <Button
              color="neutral"
              loading={isEnhancing}
              loadingIndicator={<CircularProgress color="neutral" size="sm" />}
              onClick={onEnhancePrompt}
              size="sm"
              startDecorator={<Sparkles size={14} strokeWidth={1.9} />}
              sx={{
                px: 0,
                minHeight: isMobile ? 44 : 30,
                alignSelf: "flex-start",
                visibility: hasPrompt ? "visible" : "hidden",
              }}
              variant="plain"
            >
              {isEnhancing ? "Enhancing..." : "Enhance prompt"}
            </Button>

            <Typography
              textAlign="center"
              textColor="text.tertiary"
              sx={{ fontSize: "11px", opacity: 0.4, mt: "6px" }}
            >
              Enter to generate · Shift+Enter for new line
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
