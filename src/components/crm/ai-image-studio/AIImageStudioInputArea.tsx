import React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Radio from "@mui/joy/Radio";
import RadioGroup from "@mui/joy/RadioGroup";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Typography from "@mui/joy/Typography";
import {
  ArrowUp,
  RectangleHorizontal,
  RectangleVertical,
  Settings2,
  Sparkles,
  Square,
} from "lucide-react";
import type {
  AIImageStudioAspectRatio,
  AIImageStudioGenerationConfig,
  AIImageStudioQuality,
  AIImageStudioStylePreset,
} from "./types";

interface AIImageStudioInputAreaProps {
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
  selectedImage: string | null;
}

const aspectRatioOptions: Array<{
  value: AIImageStudioAspectRatio;
  label: string;
  ratio: string;
  icon: typeof RectangleHorizontal;
}> = [
  {
    value: "1:1",
    label: "Square",
    ratio: "1:1",
    icon: Square,
  },
  {
    value: "16:9",
    label: "Landscape",
    ratio: "16:9",
    icon: RectangleHorizontal,
  },
  {
    value: "9:16",
    label: "Portrait",
    ratio: "9:16",
    icon: RectangleVertical,
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

export function AIImageStudioInputArea({
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
  selectedImage,
}: AIImageStudioInputAreaProps) {
  const hasPrompt = inputPrompt.trim().length > 0;

  return (
    <Box
      component="footer"
      sx={{
        px: paddingX,
        py: 2,
        backgroundColor: "background.surface",
        boxShadow: "0 -1px 0 0 var(--joy-palette-divider)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Stack spacing={1.5}>
        {selectedImage ? (
          <Box
            sx={{
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
              variant="solid"
            >
              Use This Image
            </Button>
          </Box>
        ) : null}

        <Box component="form" onSubmit={onSubmit} sx={{ order: 1 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Textarea
              color="neutral"
              disabled={isProcessing}
              maxRows={4}
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
                "--Textarea-focusedHighlight": "transparent",
                "--Textarea-minHeight": "44px",
                borderRadius: "12px",
                backgroundColor: "background.level1",
                transition:
                  "border-color 200ms ease, box-shadow 200ms ease, opacity 200ms ease",
                "--Textarea-focusedThickness": "2px",
                "&::before": {
                  borderRadius: "12px",
                  transition:
                    "border-color 200ms ease, box-shadow 200ms ease, opacity 200ms ease",
                },
                "& textarea": {
                  typography: "body-md",
                  color: "text.primary",
                  lineHeight: 1.55,
                },
                "& textarea::placeholder": {
                  color: "text.tertiary",
                  opacity: 1,
                },
                "&:focus-within::before": {
                  borderColor: "primary.outlinedBorder",
                  boxShadow:
                    "0 0 0 8px rgba(var(--joy-palette-primary-mainChannel) / 0.09)",
                },
                "&.Mui-disabled": {
                  opacity: 0.64,
                  boxShadow: "none",
                },
                "&.Mui-disabled::before": {
                  boxShadow: "none",
                },
              }}
              value={inputPrompt}
              variant="outlined"
            />

            <IconButton
              aria-label={isProcessing ? "Stop generation" : "Generate image"}
              color={
                isProcessing ? "danger" : hasPrompt ? "primary" : "neutral"
              }
              disabled={!isProcessing && !hasPrompt}
              onClick={isProcessing ? onStopGeneration : undefined}
              size="md"
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                boxShadow: hasPrompt && !isProcessing ? "sm" : "none",
                flexShrink: 0,
                transition:
                  "background-color 200ms ease, color 200ms ease, box-shadow 200ms ease, transform 200ms ease",
                "&:focus-visible": {
                  outline:
                    "2px solid rgba(var(--joy-palette-primary-mainChannel) / 0.32)",
                  outlineOffset: 2,
                },
              }}
              type={isProcessing ? "button" : "submit"}
              variant={isProcessing ? "soft" : hasPrompt ? "solid" : "soft"}
            >
              {isProcessing ? (
                <Square size={18} strokeWidth={2.1} />
              ) : (
                <ArrowUp size={20} strokeWidth={2.1} />
              )}
            </IconButton>
          </Stack>
        </Box>

        <Typography
          level="body-xs"
          textAlign="center"
          textColor="text.tertiary"
          sx={{ order: 2 }}
        >
          Enter to generate · Shift+Enter for new line
        </Typography>

        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ order: 4 }}
        >
          {hasPrompt ? (
            <Button
              color="neutral"
              loading={isEnhancing}
              loadingIndicator={<CircularProgress color="neutral" size="sm" />}
              onClick={onEnhancePrompt}
              size="sm"
              startDecorator={<Sparkles size={14} strokeWidth={1.9} />}
              sx={{
                order: 1,
                px: 0,
                minHeight: 30,
                alignSelf: "flex-start",
              }}
              variant="plain"
            >
              {isEnhancing ? "Enhancing..." : "Enhance prompt"}
            </Button>
          ) : (
            <Box sx={{ flex: 1 }} />
          )}

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
              order: 0,
              ml: "auto",
              transition: "transform 200ms ease",
              transform: isSettingsOpen ? "rotate(90deg)" : "rotate(0deg)",
            }}
            variant="plain"
          >
            <Settings2 size={16} strokeWidth={1.9} />
          </IconButton>
        </Stack>

        <Box
          aria-hidden={!isSettingsOpen}
          sx={{
            order: 3,
            overflow: "hidden",
            maxHeight: isSettingsOpen ? 340 : 0,
            opacity: isSettingsOpen ? 1 : 0,
            transform: isSettingsOpen ? "translateY(0)" : "translateY(-8px)",
            transition:
              "max-height 200ms ease, opacity 200ms ease, transform 200ms ease",
          }}
        >
          <Stack
            spacing={1.5}
            sx={{
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "background.level1",
              p: 1.5,
            }}
          >
            <Stack spacing={0.75}>
              <Typography level="body-xs" textColor="text.tertiary">
                Aspect ratio
              </Typography>
              <RadioGroup
                name="ai-image-studio-aspect-ratio"
                onChange={(event) =>
                  onConfigChange({
                    ...generationConfig,
                    aspectRatio: event.target.value as AIImageStudioAspectRatio,
                  })
                }
                orientation="horizontal"
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 0.75,
                }}
                value={generationConfig.aspectRatio}
              >
                {aspectRatioOptions.map((option) => {
                  const Icon = option.icon;

                  return (
                    <Radio
                      key={option.value}
                      disableIcon
                      label={
                        <Stack spacing={0.5} alignItems="center">
                          <Icon size={16} strokeWidth={1.9} />
                          <Typography level="body-xs">
                            {option.label}
                          </Typography>
                          <Typography level="body-xs" textColor="text.tertiary">
                            {option.ratio}
                          </Typography>
                        </Stack>
                      }
                      overlay
                      slotProps={{
                        action: {
                          sx: {
                            borderRadius: "md",
                            border: "1px solid",
                            borderColor:
                              generationConfig.aspectRatio === option.value
                                ? "primary.400"
                                : "divider",
                            backgroundColor:
                              generationConfig.aspectRatio === option.value
                                ? "rgba(var(--joy-palette-primary-mainChannel) / 0.05)"
                                : "transparent",
                            boxShadow:
                              generationConfig.aspectRatio === option.value
                                ? "sm"
                                : "none",
                            p: 1.25,
                          },
                        },
                      }}
                      sx={{
                        alignItems: "stretch",
                        flex: 1,
                        minHeight: 76,
                        m: 0,
                      }}
                      value={option.value}
                    />
                  );
                })}
              </RadioGroup>
            </Stack>

            <Stack spacing={0.75}>
              <Typography level="body-xs" textColor="text.tertiary">
                Style preset
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{
                  overflowX: "auto",
                  pb: 0.5,
                  scrollbarWidth: "thin",
                  "&::-webkit-scrollbar": {
                    height: 6,
                  },
                }}
              >
                {stylePresetOptions.map((option) => (
                  <Chip
                    key={option.value}
                    color={
                      generationConfig.stylePreset === option.value
                        ? "primary"
                        : "neutral"
                    }
                    onClick={() =>
                      onConfigChange({
                        ...generationConfig,
                        stylePreset: option.value,
                      })
                    }
                    sx={{ cursor: "pointer", flexShrink: 0 }}
                    variant={
                      generationConfig.stylePreset === option.value
                        ? "solid"
                        : "outlined"
                    }
                  >
                    {option.label}
                  </Chip>
                ))}
              </Stack>
            </Stack>

            <Stack spacing={0.75}>
              <Typography level="body-xs" textColor="text.tertiary">
                Quality
              </Typography>
              <ToggleButtonGroup
                onChange={(_event, value) => {
                  if (!value) {
                    return;
                  }

                  onConfigChange({
                    ...generationConfig,
                    quality: value as AIImageStudioQuality,
                  });
                }}
                sx={{
                  backgroundColor: "background.level1",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "md",
                  p: "2px",
                  "--ToggleButtonGroup-gap": "0px",
                  "--ToggleButtonGroup-radius": "10px",
                }}
                value={generationConfig.quality}
              >
                {qualityOptions.map((option) => (
                  <Button
                    key={option.value}
                    color="neutral"
                    sx={{
                      px: 1.5,
                      border: "none",
                      boxShadow:
                        generationConfig.quality === option.value
                          ? "sm"
                          : "none",
                      backgroundColor:
                        generationConfig.quality === option.value
                          ? "background.surface"
                          : "transparent",
                    }}
                    value={option.value}
                    variant="plain"
                  >
                    {option.label}
                  </Button>
                ))}
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
