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
import type { FormBuilderTokens } from "@/components/forms/build/formBuilderTokens";
import { getConsentText } from "@/lib/forms/fieldRegistry";
import {
  type FormCompliance,
  type FormField,
  type FormSettings,
} from "@/types/formBuilder";

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
  compact?: boolean;
  field: FormField;
  compliance: FormCompliance;
  settings: FormSettings;
  tokens: FormBuilderTokens;
}

export function FormFieldPreview({
  compact = false,
  field,
  compliance,
  settings,
  tokens,
}: FormFieldPreviewProps) {
  const inputVariant = resolveInputVariant(settings);
  const previewRadius = compact ? "md" : "lg";
  const helpText = compact ? null : field.help_text?.trim();
  const sharedInputSx = {
    borderRadius: compact ? previewRadius : tokens.fieldRadius,
    fontFamily: tokens.fontFamily,
    "& .MuiInput-input": {
      fontFamily: tokens.fontFamily,
      fontSize: compact ? "0.875rem" : undefined,
    },
    "& .MuiSelect-button": {
      fontSize: compact ? "0.875rem" : undefined,
    },
  } as const;

  if (field.type === "hidden") {
    return (
      <Stack spacing={compact ? 0.75 : 1}>
        <Sheet
          variant="soft"
          color="neutral"
          sx={{
            borderRadius: previewRadius,
            px: compact ? 1.1 : 1.5,
            py: compact ? 0.9 : 1.25,
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
      <Stack spacing={compact ? 0.75 : 1}>
        <Checkbox
          disabled
          checked={Boolean(field.default_value)}
          label={field.label}
          overlay
          size={compact ? "sm" : "md"}
          sx={{
            borderRadius: previewRadius,
            px: compact ? 1 : 1.25,
            py: compact ? 0.75 : 1,
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
      <Stack spacing={compact ? 0.75 : 1}>
        <Checkbox
          disabled
          checked={false}
          label={getConsentText(field.type, compliance) || field.label}
          overlay
          size={compact ? "sm" : "md"}
          sx={{
            borderRadius: previewRadius,
            px: compact ? 1 : 1.25,
            py: compact ? 0.75 : 1,
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
      <Stack spacing={compact ? 0.75 : 1}>
        <Sheet
          variant="plain"
          sx={{
            borderRadius: previewRadius,
            border: "1px dashed",
            borderColor: tokens.strongBorderColor,
            backgroundColor: tokens.hoverTint,
            px: compact ? 1.25 : 2,
            py: compact ? 1.25 : 2.5,
          }}
        >
          <Stack
            spacing={compact ? 0.75 : 1.25}
            alignItems="center"
            textAlign="center"
          >
            <Box
              sx={{
                width: compact ? 32 : 40,
                height: compact ? 32 : 40,
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
      <Stack spacing={compact ? 0.75 : 1}>
        <JoySelect
          disabled
          size={compact ? "sm" : "md"}
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
    <Stack spacing={compact ? 0.75 : 1}>
      <JoyInput
        disabled
        size={compact ? "sm" : "md"}
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
