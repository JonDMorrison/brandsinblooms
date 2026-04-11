import {
  DEFAULT_FORM_SETTINGS,
  FormBorderRadius,
  FormButtonStyle,
  FormFontFamily,
  FormInputStyle,
  FormSettings,
  FormSpacing,
  FormStep,
  FormTheme,
  FormWidth,
} from "@/types/formBuilder";

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const FONT_FAMILY_CSS_MAP: Record<FormFontFamily, string> = {
  inter: '"Inter", "Helvetica Neue", Arial, sans-serif',
  system:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Iowan Old Style, "Palatino Linotype", "Book Antiqua", Georgia, serif',
  mono: '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
};

export const FORM_FONT_FAMILY_OPTIONS: Array<{
  value: FormFontFamily;
  label: string;
}> = [
  { value: "inter", label: "Inter" },
  { value: "system", label: "System" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

export const FORM_BORDER_RADIUS_OPTIONS: Array<{
  value: FormBorderRadius;
  label: string;
}> = [
  { value: "0px", label: "None" },
  { value: "4px", label: "Small" },
  { value: "8px", label: "Medium" },
  { value: "12px", label: "Large" },
  { value: "9999px", label: "Full" },
];

export const FORM_SPACING_OPTIONS: Array<{
  value: FormSpacing;
  label: string;
  px: string;
}> = [
  { value: "compact", label: "Compact", px: "12px" },
  { value: "normal", label: "Normal", px: "16px" },
  { value: "relaxed", label: "Relaxed", px: "24px" },
];

export const FORM_BUTTON_STYLE_OPTIONS: Array<{
  value: FormButtonStyle;
  label: string;
  description: string;
}> = [
  { value: "filled", label: "Filled", description: "Solid primary button" },
  {
    value: "outlined",
    label: "Outlined",
    description: "Bordered button with transparent fill",
  },
  {
    value: "ghost",
    label: "Ghost",
    description: "Low-emphasis transparent button",
  },
];

export const FORM_INPUT_STYLE_OPTIONS: Array<{
  value: FormInputStyle;
  label: string;
  description: string;
}> = [
  {
    value: "outlined",
    label: "Outlined",
    description: "Standard bordered fields",
  },
  {
    value: "filled",
    label: "Filled",
    description: "Muted fill with minimal border",
  },
  {
    value: "underlined",
    label: "Underlined",
    description: "Bottom-border only",
  },
];

export const FORM_WIDTH_OPTIONS: Array<{
  value: FormWidth;
  label: string;
  maxWidth: string;
}> = [
  { value: "narrow", label: "Narrow", maxWidth: "480px" },
  { value: "medium", label: "Medium", maxWidth: "640px" },
  { value: "wide", label: "Wide", maxWidth: "800px" },
  { value: "full", label: "Full", maxWidth: "100%" },
];

const BORDER_RADIUS_VALUES = new Set<FormBorderRadius>(
  FORM_BORDER_RADIUS_OPTIONS.map((option) => option.value),
);
const SPACING_VALUES = new Set<FormSpacing>(
  FORM_SPACING_OPTIONS.map((option) => option.value),
);
const WIDTH_VALUES = new Set<FormWidth>(
  FORM_WIDTH_OPTIONS.map((option) => option.value),
);

function normalizeSteps(value: unknown): FormStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((step, index) => {
      const candidate =
        typeof step === "object" && step !== null && !Array.isArray(step)
          ? (step as Partial<FormStep>)
          : {};

      const normalizedIndex =
        typeof candidate.index === "number" && Number.isFinite(candidate.index)
          ? Math.max(0, Math.trunc(candidate.index))
          : index;

      return {
        index: normalizedIndex,
        title:
          typeof candidate.title === "string" && candidate.title.trim()
            ? candidate.title.trim()
            : `Step ${normalizedIndex + 1}`,
        description:
          typeof candidate.description === "string"
            ? candidate.description
            : "",
      };
    })
    .sort((left, right) => left.index - right.index)
    .map((step, index) => ({
      ...step,
      index,
      title: step.title.trim() || `Step ${index + 1}`,
    }));
}

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value.trim());
}

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return isValidHexColor(trimmed) ? trimmed.toUpperCase() : fallback;
}

export function normalizeFontFamily(value: unknown): FormFontFamily {
  if (typeof value !== "string") {
    return DEFAULT_FORM_SETTINGS.theme.font_family ?? "inter";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "inter" || normalized.includes("inter")) {
    return "inter";
  }

  if (
    normalized === "system" ||
    normalized === "inherit" ||
    normalized.includes("system-ui") ||
    normalized.includes("segoe ui")
  ) {
    return "system";
  }

  if (
    normalized === "serif" ||
    normalized.includes("serif") ||
    normalized.includes("georgia") ||
    normalized.includes("palatino")
  ) {
    return "serif";
  }

  if (
    normalized === "mono" ||
    normalized.includes("mono") ||
    normalized.includes("monospace") ||
    normalized.includes("consolas")
  ) {
    return "mono";
  }

  return DEFAULT_FORM_SETTINGS.theme.font_family ?? "inter";
}

export function getFontFamilyCss(fontFamily?: FormFontFamily): string {
  return FONT_FAMILY_CSS_MAP[
    fontFamily ?? DEFAULT_FORM_SETTINGS.theme.font_family ?? "inter"
  ];
}

export function normalizeBorderRadius(value: unknown): FormBorderRadius {
  if (
    typeof value === "string" &&
    BORDER_RADIUS_VALUES.has(value as FormBorderRadius)
  ) {
    return value as FormBorderRadius;
  }

  return DEFAULT_FORM_SETTINGS.theme.border_radius ?? "8px";
}

export function normalizeSpacing(value: unknown): FormSpacing {
  if (typeof value === "string" && SPACING_VALUES.has(value as FormSpacing)) {
    return value as FormSpacing;
  }

  return DEFAULT_FORM_SETTINGS.theme.spacing ?? "normal";
}

export function getSpacingValue(spacing?: FormSpacing): string {
  return (
    FORM_SPACING_OPTIONS.find((option) => option.value === spacing)?.px ??
    FORM_SPACING_OPTIONS.find(
      (option) => option.value === DEFAULT_FORM_SETTINGS.theme.spacing,
    )?.px ??
    "16px"
  );
}

export function normalizeButtonStyle(value: unknown): FormButtonStyle {
  if (typeof value !== "string") {
    return DEFAULT_FORM_SETTINGS.theme.button_style ?? "filled";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "filled") {
    return "filled";
  }

  if (normalized === "outlined" || normalized === "outline") {
    return "outlined";
  }

  if (normalized === "ghost") {
    return "ghost";
  }

  if (normalized === "rounded") {
    return "filled";
  }

  return DEFAULT_FORM_SETTINGS.theme.button_style ?? "filled";
}

export function normalizeInputStyle(value: unknown): FormInputStyle {
  if (typeof value !== "string") {
    return DEFAULT_FORM_SETTINGS.theme.input_style ?? "outlined";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "filled") {
    return "filled";
  }

  if (normalized === "underlined" || normalized === "underline") {
    return "underlined";
  }

  if (normalized === "outlined" || normalized === "default") {
    return "outlined";
  }

  return DEFAULT_FORM_SETTINGS.theme.input_style ?? "outlined";
}

export function normalizeFormWidth(value: unknown): FormWidth {
  if (typeof value === "string" && WIDTH_VALUES.has(value as FormWidth)) {
    return value as FormWidth;
  }

  return DEFAULT_FORM_SETTINGS.form_width ?? "medium";
}

export function getFormWidthValue(width?: FormWidth): string {
  return (
    FORM_WIDTH_OPTIONS.find((option) => option.value === width)?.maxWidth ??
    FORM_WIDTH_OPTIONS.find(
      (option) => option.value === DEFAULT_FORM_SETTINGS.form_width,
    )?.maxWidth ??
    "640px"
  );
}

export function normalizeColumns(value: unknown): 1 | 2 {
  if (value === 2 || value === "2") {
    return 2;
  }

  return 1;
}

export function normalizeFormTheme(value: unknown): FormTheme {
  const candidate =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Partial<Record<keyof FormTheme, unknown>>)
      : {};

  return {
    primary_color: normalizeHexColor(
      candidate.primary_color,
      DEFAULT_FORM_SETTINGS.theme.primary_color ?? "#22C55E",
    ),
    secondary_color: normalizeHexColor(
      candidate.secondary_color,
      DEFAULT_FORM_SETTINGS.theme.secondary_color ?? "#1E40AF",
    ),
    text_color: normalizeHexColor(
      candidate.text_color,
      DEFAULT_FORM_SETTINGS.theme.text_color ?? "#1F2937",
    ),
    background_color: normalizeHexColor(
      candidate.background_color,
      DEFAULT_FORM_SETTINGS.theme.background_color ?? "#FFFFFF",
    ),
    font_family: normalizeFontFamily(candidate.font_family),
    border_radius: normalizeBorderRadius(candidate.border_radius),
    spacing: normalizeSpacing(candidate.spacing),
    button_style: normalizeButtonStyle(candidate.button_style),
    input_style: normalizeInputStyle(candidate.input_style),
  };
}

export function normalizeFormSettings(value: unknown): FormSettings {
  const candidate =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Partial<FormSettings>)
      : {};

  return {
    ...DEFAULT_FORM_SETTINGS,
    form_title:
      typeof candidate.form_title === "string"
        ? candidate.form_title
        : DEFAULT_FORM_SETTINGS.form_title,
    form_description:
      typeof candidate.form_description === "string"
        ? candidate.form_description
        : DEFAULT_FORM_SETTINGS.form_description,
    form_headline:
      typeof candidate.form_headline === "string"
        ? candidate.form_headline
        : DEFAULT_FORM_SETTINGS.form_headline,
    form_subheadline:
      typeof candidate.form_subheadline === "string"
        ? candidate.form_subheadline
        : DEFAULT_FORM_SETTINGS.form_subheadline,
    form_width: normalizeFormWidth(candidate.form_width),
    label_position: "above",
    columns: normalizeColumns(candidate.columns),
    steps: normalizeSteps(candidate.steps),
    success_message:
      typeof candidate.success_message === "string" &&
      candidate.success_message.trim()
        ? candidate.success_message
        : DEFAULT_FORM_SETTINGS.success_message,
    success_redirect_url:
      typeof candidate.success_redirect_url === "string" &&
      candidate.success_redirect_url.trim()
        ? candidate.success_redirect_url.trim()
        : null,
    submit_button_text:
      typeof candidate.submit_button_text === "string" &&
      candidate.submit_button_text.trim()
        ? candidate.submit_button_text
        : DEFAULT_FORM_SETTINGS.submit_button_text,
    show_branding:
      typeof candidate.show_branding === "boolean"
        ? candidate.show_branding
        : DEFAULT_FORM_SETTINGS.show_branding,
    theme: normalizeFormTheme(candidate.theme),
    notification_emails: Array.isArray(candidate.notification_emails)
      ? candidate.notification_emails.filter(
          (email): email is string => typeof email === "string",
        )
      : DEFAULT_FORM_SETTINGS.notification_emails,
  };
}
