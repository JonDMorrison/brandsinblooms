import {
  getFontFamilyCss,
  getFormWidthValue,
  getSpacingValue,
} from "@/lib/forms/designSettings";
import { DEFAULT_FORM_SETTINGS, type FormSettings } from "@/types/formBuilder";

export interface FormBuilderTokens {
  backgroundColor: string;
  fieldRadius: string;
  fontFamily: string;
  formMaxWidth: string;
  hoverTint: string;
  mutedTextColor: string;
  primaryColor: string;
  spacing: string;
  strongBorderColor: string;
  subtleBorderColor: string;
  surfaceColor: string;
  textColor: string;
}

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function createFormBuilderTokens(
  settings: FormSettings,
): FormBuilderTokens {
  const theme = settings.theme ?? DEFAULT_FORM_SETTINGS.theme;
  const primaryColor =
    theme.primary_color ??
    DEFAULT_FORM_SETTINGS.theme.primary_color ??
    "#22C55E";
  const textColor =
    theme.text_color ?? DEFAULT_FORM_SETTINGS.theme.text_color ?? "#1F2937";
  const backgroundColor =
    theme.background_color ??
    DEFAULT_FORM_SETTINGS.theme.background_color ??
    "#FFFFFF";

  return {
    backgroundColor,
    fieldRadius: theme.border_radius ?? "8px",
    fontFamily: getFontFamilyCss(theme.font_family),
    formMaxWidth: getFormWidthValue(settings.form_width),
    hoverTint: toRgba(primaryColor, 0.06),
    mutedTextColor: toRgba(textColor, 0.72),
    primaryColor,
    spacing: getSpacingValue(theme.spacing),
    strongBorderColor: toRgba(textColor, 0.18),
    subtleBorderColor: toRgba(textColor, 0.1),
    surfaceColor: "#FFFFFF",
    textColor,
  };
}