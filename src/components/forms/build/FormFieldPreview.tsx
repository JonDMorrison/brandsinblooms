import * as React from "react";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { FileUp } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  getFontFamilyCss,
  getFormWidthValue,
  getSpacingValue,
} from "@/lib/forms/designSettings";
import { getConsentText } from "@/lib/forms/fieldRegistry";
import {
  DEFAULT_FORM_SETTINGS,
  type FormCompliance,
  type FormField,
  type FormSettings,
} from "@/types/formBuilder";

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

function resolveInputVariant(settings: FormSettings) {
  switch (settings.theme.input_style) {
    case "filled":
      return "soft" as const;
    case "underlined":
      return "plain" as const;
    case "outlined":
    default:
      return "outlined" as const;
  }
}

interface FormFieldPreviewProps {
  field: FormField;
  compliance: FormCompliance;
  settings: FormSettings;
  tokens: FormBuilderTokens;
}

export function FormFieldPreview({
  field,
  compliance,
  settings,
  tokens,
}: FormFieldPreviewProps) {
  const inputVariant = resolveInputVariant(settings);
  const sharedInputSx = {
    borderRadius: tokens.fieldRadius,
    fontFamily: tokens.fontFamily,
    "& .MuiInput-input": {
      fontFamily: tokens.fontFamily,
    },
  } as const;

  const helpText = field.help_text?.trim();

  if (field.type === "hidden") {
    return (
      <Stack spacing={1}>
        <Sheet
          variant="soft"
          color="neutral"
          sx={{
            borderRadius: "lg",
            px: 1.5,
            py: 1.25,
          }}
        >
          <Stack spacing={0.375}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Hidden field
            </Typography>
            <Typography level="body-xs" color="neutral">
              {field.mapping_key}
            </Typography>
          </Stack>
        </Sheet>
        {helpText ? (
          <Typography level="body-xs" sx={{ color: tokens.mutedTextColor }}>
            {helpText}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  if (field.type === "checkbox") {
    return (
      <Stack spacing={1}>
        <Checkbox
          disabled
          checked={Boolean(field.default_value)}
          label={field.label}
          overlay
          sx={{
            borderRadius: "lg",
            px: 1.25,
            py: 1,
            border: "1px solid",
            borderColor: "neutral.200",
            backgroundColor: "background.surface",
          }}
        />
        {helpText ? (
          <Typography level="body-xs" sx={{ color: tokens.mutedTextColor }}>
            {helpText}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  if (field.type === "email_consent" || field.type === "sms_consent") {
    return (
      <Stack spacing={1}>
        <Checkbox
          disabled
          checked={false}
          label={getConsentText(field.type, compliance) || field.label}
          overlay
          sx={{
            borderRadius: "lg",
            px: 1.25,
            py: 1,
            border: "1px solid",
            borderColor: "warning.200",
            backgroundColor: "warning.softBg",
          }}
        />
        {helpText ? (
          <Typography level="body-xs" sx={{ color: tokens.mutedTextColor }}>
            {helpText}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  if (field.type === "file") {
    const maxFiles = field.rules?.max_files ?? 1;
    const maxFileSizeMb = field.rules?.max_file_size_mb ?? 10;

    return (
      <Stack spacing={1}>
        <Sheet
          variant="plain"
          sx={{
            borderRadius: "lg",
            border: "1px dashed",
            borderColor: tokens.strongBorderColor,
            backgroundColor: tokens.hoverTint,
            px: 2,
            py: 2.5,
          }}
        >
          <Stack spacing={1.25} alignItems="center" textAlign="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                display: "grid",
                placeItems: "center",
                borderRadius: "999px",
                backgroundColor: "background.surface",
                border: "1px solid",
                borderColor: "neutral.200",
              }}
            >
              <FileUp size={18} />
            </Box>
            <Stack spacing={0.375}>
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                Upload up to {maxFiles} file{maxFiles === 1 ? "" : "s"}
              </Typography>
              <Typography level="body-xs" sx={{ color: tokens.mutedTextColor }}>
                Max {maxFileSizeMb} MB each
              </Typography>
            </Stack>
            <JoyButton size="sm" variant="soft" color="neutral" disabled>
              Choose files
            </JoyButton>
          </Stack>
        </Sheet>
        {helpText ? (
          <Typography level="body-xs" sx={{ color: tokens.mutedTextColor }}>
            {helpText}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  if (field.type === "select") {
    return (
      <Stack spacing={1}>
        <JoySelect
          disabled
          variant={inputVariant}
          value=""
          placeholder={field.placeholder || "Select an option"}
          options={(field.options ?? []).map((option) => ({
            value: option,
            label: option,
          }))}
          sx={sharedInputSx}
        />
        {helpText ? (
          <Typography level="body-xs" sx={{ color: tokens.mutedTextColor }}>
            {helpText}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      <JoyInput
        disabled
        variant={inputVariant}
        type={
          field.type === "email"
            ? "email"
            : field.type === "phone"
              ? "tel"
              : "text"
        }
        placeholder={field.placeholder || "Enter your answer"}
        sx={sharedInputSx}
      />
      {helpText ? (
        <Typography level="body-xs" sx={{ color: tokens.mutedTextColor }}>
          {helpText}
        </Typography>
      ) : null}
    </Stack>
  );
}
