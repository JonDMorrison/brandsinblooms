import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Typography from "@mui/joy/Typography";
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  LayoutTemplate,
  Monitor,
  Palette,
  RotateCcw,
  Smartphone,
  Tablet,
  Type,
} from "lucide-react";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  DEFAULT_BRAND_COLORS,
  useBrandColors,
} from "@/hooks/useBrandColors";
import {
  FONT_FAMILY_CSS_MAP,
  FORM_BACKGROUND_STYLE_OPTIONS,
  FORM_BORDER_RADIUS_OPTIONS,
  FORM_BUTTON_STYLE_OPTIONS,
  FORM_FONT_FAMILY_OPTIONS,
  FORM_INPUT_STYLE_OPTIONS,
  FORM_SPACING_OPTIONS,
  FORM_WIDTH_OPTIONS,
  isValidHexColor,
  normalizeFormSettings,
} from "@/lib/forms/designSettings";
import { getPublicFormUrl } from "@/lib/forms/share";
import {
  DEFAULT_FORM_COMPLIANCE,
  DEFAULT_FORM_SETTINGS,
  type FormCompliance,
  type FormField,
  type FormSettings,
  type FormTheme,
} from "@/types/formBuilder";
import { FormPreviewRenderer } from "./preview/FormPreviewRenderer";

interface FormDesignTabProps {
  settings: FormSettings;
  onSettingsChange: (settings: FormSettings) => void;
  fields?: FormField[];
  compliance?: FormCompliance;
  formName?: string;
  uploadEmbedKey?: string;
}

type DesignSectionKey = "header" | "colors" | "typography" | "style";
type PreviewDevice = "desktop" | "tablet" | "mobile";
type PreviewMode = "preview" | "embed";

const DEVICE_OPTIONS: Array<{
  value: PreviewDevice;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "desktop", label: "Desktop", icon: <Monitor size={16} /> },
  { value: "tablet", label: "Tablet", icon: <Tablet size={16} /> },
  { value: "mobile", label: "Mobile", icon: <Smartphone size={16} /> },
];

const PREVIEW_MODE_OPTIONS: Array<{
  value: PreviewMode;
  label: string;
}> = [
  { value: "preview", label: "Default view" },
  { value: "embed", label: "Published behavior" },
];

const SPACING_EDITOR_OPTIONS = FORM_SPACING_OPTIONS.filter(
  (option) => option.value === "compact" || option.value === "normal",
);

const DEFAULT_SECTION_STATE: Record<DesignSectionKey, boolean> = {
  header: true,
  colors: true,
  typography: true,
  style: true,
};

function getPreviewWidth(device: PreviewDevice) {
  switch (device) {
    case "tablet":
      return "768px";
    case "mobile":
      return "375px";
    case "desktop":
    default:
      return "100%";
  }
}

function getPreviewCanvasSx(theme: FormTheme) {
  const backgroundStyle = theme.background_style ?? "white";
  const backgroundColor =
    theme.background_color ?? DEFAULT_FORM_SETTINGS.theme.background_color ?? "#FFFFFF";

  switch (backgroundStyle) {
    case "green-tint":
      return {
        backgroundColor: "#F2F8F1",
        backgroundImage:
          "radial-gradient(circle at top right, rgba(34, 197, 94, 0.18), transparent 36%), linear-gradient(180deg, rgba(34, 197, 94, 0.06) 0%, rgba(255, 255, 255, 0.9) 100%)",
      };
    case "custom":
      return {
        backgroundColor,
        backgroundImage: `linear-gradient(180deg, ${backgroundColor} 0%, rgba(255, 255, 255, 0.86) 100%)`,
      };
    case "transparent":
      return {
        backgroundColor: "#F6F4EF",
        backgroundImage:
          "linear-gradient(135deg, rgba(15, 23, 42, 0.04) 25%, transparent 25%), linear-gradient(225deg, rgba(15, 23, 42, 0.04) 25%, transparent 25%), linear-gradient(45deg, rgba(15, 23, 42, 0.04) 25%, transparent 25%), linear-gradient(315deg, rgba(15, 23, 42, 0.04) 25%, #F6F4EF 25%)",
        backgroundSize: "20px 20px",
        backgroundPosition: "10px 0, 10px 0, 0 0, 0 0",
      };
    case "white":
    default:
      return {
        backgroundColor: "#F7F4EE",
        backgroundImage:
          "radial-gradient(circle at top, rgba(15, 23, 42, 0.03), transparent 48%), radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.1), transparent 35%)",
      };
  }
}

function SectionCard({
  icon,
  title,
  description,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "xl",
        bgcolor: "background.surface",
        borderColor: expanded ? "primary.200" : "neutral.200",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.5, py: 1.25 }}
      >
        <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
          <Avatar size="sm" variant="soft" color="neutral">
            {icon}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography level="title-sm" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography level="body-xs" color="neutral">
              {description}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </IconButton>
      </Stack>

      {expanded ? <Box sx={{ px: 1.5, pb: 1.5 }}>{children}</Box> : null}
    </Sheet>
  );
}

function ColorControl({
  label,
  helperText,
  value,
  onChange,
}: {
  label: string;
  helperText: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const colorInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <JoyInput
        value={draft}
        onValueChange={(nextValue) => {
          setDraft(nextValue.toUpperCase());
          if (isValidHexColor(nextValue)) {
            onChange(nextValue.toUpperCase());
          }
        }}
        onBlur={() => {
          if (!isValidHexColor(draft)) {
            setDraft(value);
            return;
          }

          const normalized = draft.toUpperCase();
          setDraft(normalized);
          onChange(normalized);
        }}
        placeholder="#22C55E"
        helperText={helperText}
        sx={{
          "& .MuiInput-input": {
            fontFamily:
              'var(--joy-fontFamily-code, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace)',
          },
        }}
        startDecorator={
          <Box
            component="button"
            type="button"
            onClick={() => colorInputRef.current?.click()}
            sx={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid",
              borderColor: "neutral.300",
              backgroundColor: value,
              cursor: "pointer",
              position: "relative",
              flexShrink: 0,
            }}
            aria-label={`Select ${label.toLowerCase()} color`}
          >
            <Box
              ref={colorInputRef}
              component="input"
              type="color"
              value={isValidHexColor(value) ? value : "#000000"}
              onChange={(event) => {
                const nextValue = event.target.value.toUpperCase();
                setDraft(nextValue);
                onChange(nextValue);
              }}
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
              }}
            />
          </Box>
        }
      />
    </FormControl>
  );
}

function RadiusThumbnail({ radius }: { radius: string }) {
  return (
    <Box
      sx={{
        width: 30,
        height: 20,
        borderRadius: radius,
        border: "1px solid",
        borderColor: "currentColor",
        backgroundColor: "rgba(255, 255, 255, 0.72)",
      }}
    />
  );
}

function StyleCard({
  selected,
  title,
  description,
  preview,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  preview: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Sheet
      variant="plain"
      onClick={onClick}
      sx={{
        borderRadius: "lg",
        border: "1px solid",
        borderColor: selected ? "primary.300" : "neutral.200",
        bgcolor: selected ? "primary.softBg" : "background.surface",
        cursor: "pointer",
        p: 1.25,
        transition:
          "border-color 160ms ease, background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
        boxShadow: selected ? "var(--joy-shadow-sm)" : "none",
        "&:hover": {
          borderColor: selected ? "primary.400" : "neutral.300",
          transform: "translateY(-1px)",
        },
      }}
    >
      <Stack spacing={1}>
        <Sheet
          variant="soft"
          color={selected ? "primary" : "neutral"}
          sx={{
            borderRadius: "lg",
            p: 1,
            minHeight: 72,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          {preview}
        </Sheet>
        <Box>
          <Typography level="body-sm" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography level="body-xs" color="neutral">
            {description}
          </Typography>
        </Box>
      </Stack>
    </Sheet>
  );
}

function FormStylePreview({ style }: { style: FormTheme["button_style"] }) {
  const commonSx = {
    minWidth: 84,
    minHeight: 34,
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 700,
    display: "grid",
    placeItems: "center",
    px: 1.5,
  };

  if (style === "outlined") {
    return (
      <Box
        sx={{
          ...commonSx,
          border: "1px solid",
          borderColor: "primary.500",
          color: "primary.700",
          bgcolor: "rgba(255,255,255,0.7)",
        }}
      >
        Submit
      </Box>
    );
  }

  if (style === "ghost") {
    return (
      <Box
        sx={{
          ...commonSx,
          color: "primary.700",
          bgcolor: "rgba(255,255,255,0.38)",
        }}
      >
        Submit
      </Box>
    );
  }

  return (
    <Box
      sx={{
        ...commonSx,
        bgcolor: "primary.500",
        color: "common.white",
      }}
    >
      Submit
    </Box>
  );
}

function InputStylePreview({ style }: { style: FormTheme["input_style"] }) {
  if (style === "filled") {
    return (
      <Box
        sx={{
          width: "100%",
          maxWidth: 130,
          borderRadius: "md",
          bgcolor: "rgba(255,255,255,0.72)",
          border: "1px solid",
          borderColor: "rgba(15, 23, 42, 0.06)",
          px: 1.25,
          py: 1,
        }}
      >
        <Box sx={{ width: 48, height: 8, borderRadius: 999, bgcolor: "neutral.300", mb: 0.75 }} />
        <Box sx={{ width: "100%", height: 10, borderRadius: 999, bgcolor: "neutral.200" }} />
      </Box>
    );
  }

  if (style === "underlined") {
    return (
      <Box sx={{ width: "100%", maxWidth: 130, px: 0.5, py: 1 }}>
        <Box sx={{ width: 48, height: 8, borderRadius: 999, bgcolor: "neutral.300", mb: 1 }} />
        <Box sx={{ width: "100%", height: 2, borderRadius: 999, bgcolor: "primary.500" }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 130,
        borderRadius: "md",
        bgcolor: "rgba(255,255,255,0.72)",
        border: "1px solid",
        borderColor: "primary.300",
        px: 1.25,
        py: 1,
      }}
    >
      <Box sx={{ width: 48, height: 8, borderRadius: 999, bgcolor: "neutral.300", mb: 0.75 }} />
      <Box sx={{ width: "100%", height: 10, borderRadius: 999, bgcolor: "neutral.200" }} />
    </Box>
  );
}

function BackgroundStylePreview({ style }: { style: FormTheme["background_style"] }) {
  let sx = {
    bgcolor: "#FFFFFF",
    backgroundImage:
      "linear-gradient(180deg, rgba(15,23,42,0.03) 0%, rgba(255,255,255,0.92) 100%)",
  };

  if (style === "green-tint") {
    sx = {
      bgcolor: "#ECF7EC",
      backgroundImage:
        "radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 36%), linear-gradient(180deg, rgba(34,197,94,0.08) 0%, rgba(255,255,255,0.9) 100%)",
    };
  }

  if (style === "transparent") {
    sx = {
      bgcolor: "#F4F1E9",
      backgroundImage:
        "linear-gradient(135deg, rgba(15,23,42,0.04) 25%, transparent 25%), linear-gradient(225deg, rgba(15,23,42,0.04) 25%, transparent 25%), linear-gradient(45deg, rgba(15,23,42,0.04) 25%, transparent 25%), linear-gradient(315deg, rgba(15,23,42,0.04) 25%, #F4F1E9 25%)",
    };
  }

  if (style === "custom") {
    sx = {
      bgcolor: "#E8F5F0",
      backgroundImage:
        "linear-gradient(180deg, rgba(8,145,178,0.16) 0%, rgba(236,253,245,0.92) 100%)",
    };
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: 54,
        borderRadius: "lg",
        border: "1px solid",
        borderColor: "rgba(15,23,42,0.08)",
        ...sx,
      }}
    >
      <Box
        sx={{
          width: 50,
          height: 6,
          borderRadius: 999,
          bgcolor: "rgba(15, 23, 42, 0.18)",
          mt: 1,
          ml: 1,
        }}
      />
    </Box>
  );
}

function SectionSkeleton() {
  return (
    <Sheet
      variant="outlined"
      sx={{ borderRadius: "xl", bgcolor: "background.surface", p: 1.5 }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Skeleton variant="circular" width={36} height={36} />
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Skeleton variant="text" width="42%" height={18} />
            <Skeleton variant="text" width="72%" height={14} />
          </Stack>
        </Stack>
        <Skeleton variant="rectangular" width="100%" height={38} sx={{ borderRadius: "lg" }} />
        <Skeleton variant="rectangular" width="100%" height={64} sx={{ borderRadius: "lg" }} />
      </Stack>
    </Sheet>
  );
}

function FormDesignTabSkeleton({ stacked }: { stacked: boolean }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: stacked
          ? "1fr"
          : "minmax(0, 1fr) minmax(420px, 0.95fr)",
        gap: 3,
        alignItems: "start",
      }}
    >
      <Stack spacing={2.5}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SectionSkeleton key={index} />
        ))}
      </Stack>

      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "xl",
          bgcolor: "background.surface",
          p: 1.5,
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Skeleton variant="rectangular" width={148} height={34} sx={{ borderRadius: 999 }} />
            <Skeleton variant="rectangular" width={182} height={34} sx={{ borderRadius: 999 }} />
          </Stack>
          <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: "lg" }} />
          <Skeleton variant="rectangular" width="100%" height={560} sx={{ borderRadius: "xl" }} />
        </Stack>
      </Sheet>
    </Box>
  );
}

export function FormDesignTab({
  settings,
  onSettingsChange,
  fields = [],
  compliance = DEFAULT_FORM_COMPLIANCE,
  formName,
  uploadEmbedKey,
}: FormDesignTabProps) {
  const normalizedSettings = React.useMemo(
    () => normalizeFormSettings(settings),
    [settings],
  );
  const rawTheme = React.useMemo(
    () => ({
      ...DEFAULT_FORM_SETTINGS.theme,
      ...(settings.theme ?? {}),
    }),
    [settings.theme],
  );
  const rawSettings = React.useMemo(
    () => ({
      ...DEFAULT_FORM_SETTINGS,
      ...settings,
      theme: rawTheme,
    }),
    [rawTheme, settings],
  );
  const { data: queriedBrandColors } = useBrandColors();
  const brandColors = queriedBrandColors ?? DEFAULT_BRAND_COLORS;
  const isStackedLayout = useMediaQuery("(max-width: 1199.95px)");
  const previewSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [expandedSections, setExpandedSections] = React.useState(
    DEFAULT_SECTION_STATE,
  );
  const [showInitialSkeleton, setShowInitialSkeleton] = React.useState(true);
  const [previewDevice, setPreviewDevice] = React.useState<PreviewDevice>(
    "desktop",
  );
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("preview");
  const [showMobilePreview, setShowMobilePreview] = React.useState(false);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setShowInitialSkeleton(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  React.useEffect(() => {
    if (isStackedLayout) {
      setPreviewDevice("mobile");
      setShowMobilePreview(false);
      return;
    }

    setShowMobilePreview(true);
  }, [isStackedLayout]);

  const toggleSection = React.useCallback((section: DesignSectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

  const updateSettings = React.useCallback(
    (updates: Partial<FormSettings>) => {
      onSettingsChange(
        normalizeFormSettings({
          ...normalizedSettings,
          ...updates,
        }),
      );
    },
    [normalizedSettings, onSettingsChange],
  );

  const updateRawSettings = React.useCallback(
    (updates: Partial<FormSettings>) => {
      onSettingsChange({
        ...settings,
        ...updates,
      });
    },
    [onSettingsChange, settings],
  );

  const updateTheme = React.useCallback(
    (updates: Partial<FormSettings["theme"]>) => {
      updateSettings({
        theme: {
          ...normalizedSettings.theme,
          ...updates,
        },
      });
    },
    [normalizedSettings.theme, updateSettings],
  );

  const handleResetBrandColors = React.useCallback(() => {
    updateTheme({
      primary_color:
        brandColors.primary ?? DEFAULT_FORM_SETTINGS.theme.primary_color,
      secondary_color:
        brandColors.secondary ?? DEFAULT_FORM_SETTINGS.theme.secondary_color,
      text_color: brandColors.text ?? DEFAULT_FORM_SETTINGS.theme.text_color,
      background_color:
        brandColors.background ?? DEFAULT_FORM_SETTINGS.theme.background_color,
    });
  }, [brandColors, updateTheme]);

  const publicPreviewUrl = React.useMemo(
    () => getPublicFormUrl(uploadEmbedKey || "preview"),
    [uploadEmbedKey],
  );

  const previewSettings = React.useMemo(
    () =>
      previewMode === "embed"
        ? normalizeFormSettings({
            ...normalizedSettings,
            success_redirect_url: null,
          })
        : normalizedSettings,
    [normalizedSettings, previewMode],
  );

  const previewModeHelperText =
    previewMode === "embed" && normalizedSettings.success_redirect_url
      ? "Redirect navigation is suppressed inside the editor preview."
      : "";

  const previewWrapperMaxWidth = getPreviewWidth(previewDevice);
  const previewCanvasSx = getPreviewCanvasSx(normalizedSettings.theme);
  const displayedSpacingValue =
    normalizedSettings.theme.spacing === "compact" ? "compact" : "normal";

  const handlePreviewFabClick = React.useCallback(() => {
    if (!showMobilePreview) {
      setShowMobilePreview(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          previewSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      });
      return;
    }

    previewSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [showMobilePreview]);

  if (showInitialSkeleton) {
    return <FormDesignTabSkeleton stacked={isStackedLayout} />;
  }

  return (
    <Box sx={{ width: "100%", pb: isStackedLayout ? 10 : 0 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isStackedLayout
            ? "1fr"
            : "minmax(0, 1fr) minmax(420px, 0.95fr)",
          gap: 3,
          alignItems: "start",
        }}
      >
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <SectionCard
            icon={<AlignLeft size={18} />}
            title="Header Content"
            description="Shape the core copy visitors see before they start completing the form."
            expanded={expandedSections.header}
            onToggle={() => toggleSection("header")}
          >
            <Stack spacing={2}>
              <JoyInput
                label="Title"
                value={rawSettings.form_title ?? ""}
                onValueChange={(form_title) => updateRawSettings({ form_title })}
                placeholder="Join our newsletter"
              />

              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  minRows={2}
                  value={rawSettings.form_description ?? ""}
                  onChange={(event) =>
                    updateRawSettings({ form_description: event.target.value })
                  }
                  placeholder="Tell visitors what they get…"
                  sx={{ borderRadius: "lg", bgcolor: "background.surface" }}
                />
              </FormControl>

              <JoyInput
                label="Headline"
                value={rawSettings.form_headline ?? ""}
                onValueChange={(form_headline) =>
                  updateRawSettings({ form_headline })
                }
                placeholder="Stay in the loop"
              />

              <JoyInput
                label="Subheadline"
                value={rawSettings.form_subheadline ?? ""}
                onValueChange={(form_subheadline) =>
                  updateRawSettings({ form_subheadline })
                }
                placeholder="Weekly updates, event reminders…"
              />

              <JoyInput
                label="Button text"
                value={rawSettings.submit_button_text ?? ""}
                onValueChange={(submit_button_text) =>
                  updateRawSettings({ submit_button_text })
                }
                placeholder="Submit"
              />
            </Stack>
          </SectionCard>

          <SectionCard
            icon={<Palette size={18} />}
            title="Brand Colors"
            description="Tune the main palette used across actions, accents, type, and the form surface."
            expanded={expandedSections.colors}
            onToggle={() => toggleSection("colors")}
          >
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                <ColorControl
                  label="Primary"
                  helperText="Buttons, links, and focus states."
                  value={
                    normalizedSettings.theme.primary_color ??
                    DEFAULT_FORM_SETTINGS.theme.primary_color ??
                    "#22C55E"
                  }
                  onChange={(primary_color) => updateTheme({ primary_color })}
                />
                <ColorControl
                  label="Secondary"
                  helperText="Accents and supportive emphasis."
                  value={
                    normalizedSettings.theme.secondary_color ??
                    DEFAULT_FORM_SETTINGS.theme.secondary_color ??
                    "#1E40AF"
                  }
                  onChange={(secondary_color) => updateTheme({ secondary_color })}
                />
                <ColorControl
                  label="Text"
                  helperText="Headings, labels, and body copy."
                  value={
                    normalizedSettings.theme.text_color ??
                    DEFAULT_FORM_SETTINGS.theme.text_color ??
                    "#1F2937"
                  }
                  onChange={(text_color) => updateTheme({ text_color })}
                />
                <ColorControl
                  label="Surface"
                  helperText="The form container background color."
                  value={
                    normalizedSettings.theme.background_color ??
                    DEFAULT_FORM_SETTINGS.theme.background_color ??
                    "#FFFFFF"
                  }
                  onChange={(background_color) =>
                    updateTheme({ background_color })
                  }
                />
              </Box>

              <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                <Button
                  size="sm"
                  variant="plain"
                  color="neutral"
                  startDecorator={<RotateCcw size={16} />}
                  onClick={handleResetBrandColors}
                >
                  Reset to brand colors
                </Button>
              </Box>
            </Stack>
          </SectionCard>

          <SectionCard
            icon={<Type size={18} />}
            title="Typography & Spacing"
            description="Set the voice, curvature, and rhythm of the public form surface."
            expanded={expandedSections.typography}
            onToggle={() => toggleSection("typography")}
          >
            <Stack spacing={2}>
              <JoySelect
                label="Font family"
                value={normalizedSettings.theme.font_family ?? "inter"}
                options={FORM_FONT_FAMILY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        width: "100%",
                        fontFamily: FONT_FAMILY_CSS_MAP[option.value],
                      }}
                    >
                      <span>{option.label}</span>
                      <Typography level="body-xs" color="neutral">
                        Aa
                      </Typography>
                    </Box>
                  ),
                }))}
                onValueChange={(font_family) =>
                  updateTheme({
                    font_family:
                      font_family as FormSettings["theme"]["font_family"],
                  })
                }
                helperText="Preview labels use the selected stack without loading external fonts inside the editor."
              />

              <FormControl>
                <FormLabel>Border radius</FormLabel>
                <ToggleButtonGroup
                  size="sm"
                  value={normalizedSettings.theme.border_radius ?? "8px"}
                  onChange={(_event, value) => {
                    if (!value) {
                      return;
                    }

                    updateTheme({
                      border_radius:
                        value as FormSettings["theme"]["border_radius"],
                    });
                  }}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(5, minmax(0, 1fr))",
                    },
                    gap: 1,
                    backgroundColor: "transparent",
                  }}
                >
                  {FORM_BORDER_RADIUS_OPTIONS.map((option) => {
                    const selected =
                      (normalizedSettings.theme.border_radius ?? "8px") ===
                      option.value;

                    return (
                      <Button
                        key={option.value}
                        value={option.value}
                        variant={selected ? "solid" : "outlined"}
                        color={selected ? "primary" : "neutral"}
                        sx={{
                          display: "grid",
                          gap: 0.5,
                          justifyItems: "center",
                          minHeight: 70,
                          borderRadius: "lg",
                        }}
                      >
                        <RadiusThumbnail radius={option.value} />
                        <Typography level="body-xs">{option.label}</Typography>
                      </Button>
                    );
                  })}
                </ToggleButtonGroup>
              </FormControl>

              <FormControl>
                <FormLabel>Spacing</FormLabel>
                <ToggleButtonGroup
                  size="sm"
                  value={displayedSpacingValue}
                  onChange={(_event, value) => {
                    if (!value) {
                      return;
                    }

                    updateTheme({
                      spacing: value as FormSettings["theme"]["spacing"],
                    });
                  }}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 1,
                    backgroundColor: "transparent",
                  }}
                >
                  {SPACING_EDITOR_OPTIONS.map((option) => {
                    const selected = displayedSpacingValue === option.value;

                    return (
                      <Button
                        key={option.value}
                        value={option.value}
                        variant={selected ? "solid" : "outlined"}
                        color={selected ? "primary" : "neutral"}
                        sx={{
                          display: "grid",
                          gap: 0.35,
                          justifyItems: "center",
                          minHeight: 74,
                          borderRadius: "lg",
                        }}
                      >
                        <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                          {option.label}
                        </Typography>
                        <Typography level="body-xs">{option.px} rhythm</Typography>
                      </Button>
                    );
                  })}
                </ToggleButtonGroup>
                <FormHelperText>
                  Controls the vertical breathing room between preview sections and fields.
                </FormHelperText>
              </FormControl>
            </Stack>
          </SectionCard>

          <SectionCard
            icon={<LayoutTemplate size={18} />}
            title="Form Style"
            description="Choose the visual treatment for buttons, inputs, background, and overall canvas width."
            expanded={expandedSections.style}
            onToggle={() => toggleSection("style")}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                  Button Style
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1,
                  }}
                >
                  {FORM_BUTTON_STYLE_OPTIONS.map((option) => (
                    <StyleCard
                      key={option.value}
                      selected={
                        (normalizedSettings.theme.button_style ?? "filled") ===
                        option.value
                      }
                      title={option.label}
                      description={option.description}
                      preview={<FormStylePreview style={option.value} />}
                      onClick={() =>
                        updateTheme({
                          button_style:
                            option.value as FormSettings["theme"]["button_style"],
                        })
                      }
                    />
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                  Input Style
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 1,
                  }}
                >
                  {FORM_INPUT_STYLE_OPTIONS.map((option) => (
                    <StyleCard
                      key={option.value}
                      selected={
                        (normalizedSettings.theme.input_style ?? "outlined") ===
                        option.value
                      }
                      title={option.label}
                      description={option.description}
                      preview={<InputStylePreview style={option.value} />}
                      onClick={() =>
                        updateTheme({
                          input_style:
                            option.value as FormSettings["theme"]["input_style"],
                        })
                      }
                    />
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: "neutral.500", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1 }}>
                  Background Style
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 1,
                  }}
                >
                  {FORM_BACKGROUND_STYLE_OPTIONS.map((option) => (
                    <StyleCard
                      key={option.value}
                      selected={
                        (normalizedSettings.theme.background_style ?? "white") ===
                        option.value
                      }
                      title={option.label}
                      description={option.description}
                      preview={<BackgroundStylePreview style={option.value} />}
                      onClick={() =>
                        updateTheme({
                          background_style:
                            option.value as FormSettings["theme"]["background_style"],
                        })
                      }
                    />
                  ))}
                </Box>
              </Box>

              <FormControl>
                <FormLabel>Form width</FormLabel>
                <ToggleButtonGroup
                  size="sm"
                  value={normalizedSettings.form_width ?? "medium"}
                  onChange={(_event, value) => {
                    if (!value) {
                      return;
                    }

                    updateSettings({
                      form_width: value as FormSettings["form_width"],
                    });
                  }}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(4, minmax(0, 1fr))",
                    },
                    gap: 1,
                    backgroundColor: "transparent",
                  }}
                >
                  {FORM_WIDTH_OPTIONS.map((option) => {
                    const selected =
                      (normalizedSettings.form_width ?? "medium") === option.value;

                    return (
                      <Button
                        key={option.value}
                        value={option.value}
                        variant={selected ? "solid" : "outlined"}
                        color={selected ? "primary" : "neutral"}
                        sx={{
                          display: "grid",
                          gap: 0.35,
                          justifyItems: "center",
                          minHeight: 74,
                          borderRadius: "lg",
                        }}
                      >
                        <Box
                          sx={{
                            width: option.maxWidth === "100%" ? 48 : option.maxWidth === "800px" ? 40 : option.maxWidth === "640px" ? 32 : 24,
                            height: 16,
                            borderRadius: "sm",
                            bgcolor: "rgba(255, 255, 255, 0.76)",
                            border: "1px solid",
                            borderColor: "currentColor",
                          }}
                        />
                        <Typography level="body-xs">{option.label}</Typography>
                      </Button>
                    );
                  })}
                </ToggleButtonGroup>
              </FormControl>
            </Stack>
          </SectionCard>
        </Stack>

        {(!isStackedLayout || showMobilePreview) ? (
          <Box
            ref={previewSectionRef}
            sx={{
              position: isStackedLayout ? "static" : "sticky",
              top: isStackedLayout ? "auto" : 24,
              alignSelf: "start",
              minWidth: 0,
            }}
          >
            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "xl",
                bgcolor: "background.surface",
                borderColor: "neutral.200",
                overflow: "hidden",
              }}
            >
              <Stack spacing={1.5} sx={{ p: 1.5 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <ToggleButtonGroup
                    size="sm"
                    value={previewDevice}
                    onChange={(_event, value) => {
                      if (value) {
                        setPreviewDevice(value);
                      }
                    }}
                    sx={{
                      borderRadius: "lg",
                      border: "1px solid",
                      borderColor: "neutral.200",
                      bgcolor: "background.surface",
                    }}
                  >
                    {DEVICE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        value={option.value}
                        variant={previewDevice === option.value ? "solid" : "plain"}
                        color={previewDevice === option.value ? "primary" : "neutral"}
                        startDecorator={option.icon}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </ToggleButtonGroup>

                  <ToggleButtonGroup
                    size="sm"
                    value={previewMode}
                    onChange={(_event, value) => {
                      if (value) {
                        setPreviewMode(value);
                      }
                    }}
                    sx={{
                      borderRadius: "lg",
                      border: "1px solid",
                      borderColor: "neutral.200",
                      bgcolor: "background.surface",
                    }}
                  >
                    {PREVIEW_MODE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        value={option.value}
                        variant={previewMode === option.value ? "solid" : "plain"}
                        color={previewMode === option.value ? "primary" : "neutral"}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </ToggleButtonGroup>
                </Stack>

                <Box>
                  <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                    Live preview
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {formName
                      ? `The public runtime updates immediately for ${formName}.`
                      : "The public runtime updates immediately as you change each control."}
                  </Typography>
                  {previewModeHelperText ? (
                    <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                      {previewModeHelperText}
                    </Typography>
                  ) : null}
                </Box>

                <Sheet
                  variant="plain"
                  sx={{
                    ...previewCanvasSx,
                    borderRadius: "xl",
                    border: "1px solid",
                    borderColor: "neutral.200",
                    p: { xs: 1.5, md: 2 },
                    minHeight: 620,
                    overflow: "auto",
                  }}
                >
                  <Box
                    sx={{
                      width: "100%",
                      maxWidth: previewWrapperMaxWidth,
                      marginInline: "auto",
                      transition:
                        "max-width 220ms ease, transform 220ms ease, box-shadow 220ms ease",
                    }}
                  >
                    <Sheet
                      variant="outlined"
                      sx={{
                        borderRadius: "xl",
                        overflow: "hidden",
                        bgcolor: "background.surface",
                        boxShadow: "var(--joy-shadow-lg)",
                        borderColor: "neutral.200",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          px: 1.25,
                          py: 1,
                          borderBottom: "1px solid",
                          borderColor: "neutral.200",
                          bgcolor: "background.surface",
                        }}
                      >
                        <Stack direction="row" spacing={0.75}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#F87171" }} />
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#FBBF24" }} />
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#34D399" }} />
                        </Stack>
                        <Sheet
                          variant="soft"
                          color="neutral"
                          sx={{
                            borderRadius: 999,
                            px: 1.25,
                            py: 0.5,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <Typography level="body-xs" color="neutral" noWrap>
                            {publicPreviewUrl}
                          </Typography>
                        </Sheet>
                      </Stack>

                      <Box sx={{ p: { xs: 1, md: 1.5 } }}>
                        <FormPreviewRenderer
                          fields={fields}
                          settings={previewSettings}
                          compliance={compliance}
                          mode={previewMode}
                          uploadEmbedKey={uploadEmbedKey}
                          onSubmit={previewMode === "embed" ? async () => {} : undefined}
                        />
                      </Box>
                    </Sheet>
                  </Box>
                </Sheet>
              </Stack>
            </Sheet>
          </Box>
        ) : null}
      </Box>

      {isStackedLayout ? (
        <Button
          color="primary"
          variant="solid"
          startDecorator={<Eye size={16} />}
          onClick={() => {
            if (showMobilePreview) {
              setShowMobilePreview(false);
              return;
            }

            handlePreviewFabClick();
          }}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 20,
            borderRadius: 999,
            px: 1.5,
            py: 1,
            boxShadow: "var(--joy-shadow-lg)",
          }}
        >
          {showMobilePreview ? "Hide preview" : "Preview"}
        </Button>
      ) : null}
    </Box>
  );
}