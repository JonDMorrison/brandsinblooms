import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import {
  AlignLeft,
  Layout,
  Palette,
  RotateCcw,
  Sparkles,
  Type,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { useBrandColors } from "@/hooks/useBrandColors";
import {
  FORM_BORDER_RADIUS_OPTIONS,
  FORM_BUTTON_STYLE_OPTIONS,
  FORM_FONT_FAMILY_OPTIONS,
  FORM_INPUT_STYLE_OPTIONS,
  FORM_SPACING_OPTIONS,
  FORM_WIDTH_OPTIONS,
  isValidHexColor,
  normalizeFormSettings,
} from "@/lib/forms/designSettings";
import {
  DEFAULT_FORM_COMPLIANCE,
  DEFAULT_FORM_SETTINGS,
  type FormCompliance,
  type FormField,
  type FormSettings,
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

const LABEL_POSITION_OPTIONS = [
  { value: "top", label: "Labels above fields" },
  { value: "left", label: "Labels beside fields" },
] as const;

const COLUMN_OPTIONS = [
  { value: "1", label: "Single column" },
  { value: "2", label: "Two columns" },
] as const;

function OptionCardGroup({
  label,
  helperText,
  value,
  options,
  onChange,
}: {
  label: string;
  helperText: string;
  value: string;
  options: Array<{ value: string; label: string; description?: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
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
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Sheet
              key={option.value}
              variant={selected ? "soft" : "plain"}
              color={selected ? "primary" : "neutral"}
              onClick={() => onChange(option.value)}
              sx={{
                borderRadius: "lg",
                border: "1px solid",
                borderColor: selected ? "primary.300" : "neutral.200",
                px: 2,
                py: 1.5,
                cursor: "pointer",
                transition:
                  "border-color 160ms ease, background-color 160ms ease",
                "&:hover": {
                  borderColor: selected ? "primary.400" : "neutral.300",
                },
              }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  {option.label}
                </Typography>
                {option.description ? (
                  <Typography level="body-xs" color="neutral">
                    {option.description}
                  </Typography>
                ) : null}
              </Stack>
            </Sheet>
          );
        })}
      </Box>
      <FormHelperText>{helperText}</FormHelperText>
    </FormControl>
  );
}

function ColorField({
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
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "lg",
            border: "1px solid",
            borderColor: "neutral.200",
            backgroundColor: value,
            overflow: "hidden",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <Box
            component="input"
            type="color"
            value={isValidHexColor(value) ? value : "#000000"}
            onChange={(event) => onChange(event.target.value)}
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
        <JoyInput
          value={value}
          onValueChange={onChange}
          placeholder="#22C55E"
          helperText={helperText}
        />
      </Stack>
    </FormControl>
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
  const { data: brandColors } = useBrandColors();
  const [submitButtonTextDraft, setSubmitButtonTextDraft] = React.useState(
    normalizedSettings.submit_button_text,
  );
  const [successMessageDraft, setSuccessMessageDraft] = React.useState(
    normalizedSettings.success_message,
  );
  const [successRedirectUrlDraft, setSuccessRedirectUrlDraft] = React.useState(
    normalizedSettings.success_redirect_url ?? "",
  );
  const [isSubmitButtonFocused, setIsSubmitButtonFocused] =
    React.useState(false);
  const [isSuccessMessageFocused, setIsSuccessMessageFocused] =
    React.useState(false);
  const [isSuccessRedirectFocused, setIsSuccessRedirectFocused] =
    React.useState(false);

  React.useEffect(() => {
    if (!isSubmitButtonFocused) {
      setSubmitButtonTextDraft(normalizedSettings.submit_button_text);
    }
  }, [isSubmitButtonFocused, normalizedSettings.submit_button_text]);

  React.useEffect(() => {
    if (!isSuccessMessageFocused) {
      setSuccessMessageDraft(normalizedSettings.success_message);
    }
  }, [isSuccessMessageFocused, normalizedSettings.success_message]);

  React.useEffect(() => {
    if (!isSuccessRedirectFocused) {
      setSuccessRedirectUrlDraft(normalizedSettings.success_redirect_url ?? "");
    }
  }, [isSuccessRedirectFocused, normalizedSettings.success_redirect_url]);

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
        brandColors?.primary ?? DEFAULT_FORM_SETTINGS.theme.primary_color,
      secondary_color:
        brandColors?.secondary ?? DEFAULT_FORM_SETTINGS.theme.secondary_color,
      text_color: brandColors?.text ?? DEFAULT_FORM_SETTINGS.theme.text_color,
      background_color:
        brandColors?.background ?? DEFAULT_FORM_SETTINGS.theme.background_color,
    });
  }, [brandColors, updateTheme]);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          xl: "minmax(0, 1.2fr) minmax(380px, 0.8fr)",
        },
        gap: 3,
        alignItems: "start",
      }}
    >
      <Stack spacing={3}>
        <JoyCard>
          <JoyCardHeader
            startDecorator={
              <Avatar size="sm" variant="soft" color="neutral">
                <AlignLeft size={18} />
              </Avatar>
            }
            title="Header content"
            description="Define the copy visitors see before they start filling in the form."
          />
          <JoyCardContent sx={{ pt: 3, gap: 2 }}>
            <JoyInput
              label="Form title"
              value={normalizedSettings.form_title ?? ""}
              onValueChange={(form_title) => updateSettings({ form_title })}
              placeholder="Join our newsletter"
            />
            <FormControl>
              <FormLabel>Form description</FormLabel>
              <Textarea
                minRows={3}
                value={normalizedSettings.form_description ?? ""}
                placeholder="Tell visitors what they get when they sign up."
                onChange={(event) =>
                  updateSettings({ form_description: event.target.value })
                }
                sx={{ borderRadius: "lg" }}
              />
            </FormControl>
            <JoyInput
              label="Headline"
              value={normalizedSettings.form_headline ?? ""}
              onValueChange={(form_headline) =>
                updateSettings({ form_headline })
              }
              placeholder="Stay in the loop"
            />
            <JoyInput
              label="Subheadline"
              value={normalizedSettings.form_subheadline ?? ""}
              onValueChange={(form_subheadline) =>
                updateSettings({ form_subheadline })
              }
              placeholder="Weekly updates, event reminders, and product launches."
            />
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            startDecorator={
              <Avatar size="sm" variant="soft" color="neutral">
                <Palette size={18} />
              </Avatar>
            }
            title="Colors and theme"
            description="Control the palette used for buttons, accents, text, and the form surface."
            actions={
              <JoyButton
                bloomVariant="ghost"
                color="neutral"
                startDecorator={<RotateCcw size={16} />}
                onClick={handleResetBrandColors}
              >
                Reset to brand colors
              </JoyButton>
            }
          />
          <JoyCardContent
            sx={{
              pt: 3,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            <ColorField
              label="Primary"
              helperText="Buttons, links, and focused states."
              value={
                normalizedSettings.theme.primary_color ??
                DEFAULT_FORM_SETTINGS.theme.primary_color ??
                "#22C55E"
              }
              onChange={(primary_color) => updateTheme({ primary_color })}
            />
            <ColorField
              label="Secondary"
              helperText="Secondary accents and supportive emphasis."
              value={
                normalizedSettings.theme.secondary_color ??
                DEFAULT_FORM_SETTINGS.theme.secondary_color ??
                "#1E40AF"
              }
              onChange={(secondary_color) => updateTheme({ secondary_color })}
            />
            <ColorField
              label="Text"
              helperText="Headings, labels, and body copy."
              value={
                normalizedSettings.theme.text_color ??
                DEFAULT_FORM_SETTINGS.theme.text_color ??
                "#1F2937"
              }
              onChange={(text_color) => updateTheme({ text_color })}
            />
            <ColorField
              label="Surface"
              helperText="The form container background color."
              value={
                normalizedSettings.theme.background_color ??
                DEFAULT_FORM_SETTINGS.theme.background_color ??
                "#FFFFFF"
              }
              onChange={(background_color) => updateTheme({ background_color })}
            />
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            startDecorator={
              <Avatar size="sm" variant="soft" color="neutral">
                <Type size={18} />
              </Avatar>
            }
            title="Typography and spacing"
            description="Tune the typographic voice, curvature, and pacing of the form surface."
          />
          <JoyCardContent sx={{ pt: 3, gap: 2.5 }}>
            <JoySelect
              label="Font family"
              value={
                normalizedSettings.theme.font_family ??
                DEFAULT_FORM_SETTINGS.theme.font_family ??
                "inter"
              }
              options={FORM_FONT_FAMILY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onValueChange={(font_family) =>
                updateTheme({
                  font_family:
                    font_family as FormSettings["theme"]["font_family"],
                })
              }
            />
            <OptionCardGroup
              label="Border radius"
              helperText="Use tighter corners for a utilitarian feel or softer curves for a friendlier presentation."
              value={
                normalizedSettings.theme.border_radius ??
                DEFAULT_FORM_SETTINGS.theme.border_radius ??
                "8px"
              }
              options={FORM_BORDER_RADIUS_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              onChange={(border_radius) =>
                updateTheme({
                  border_radius:
                    border_radius as FormSettings["theme"]["border_radius"],
                })
              }
            />
            <OptionCardGroup
              label="Spacing"
              helperText="Controls vertical breathing room between blocks and fields."
              value={
                normalizedSettings.theme.spacing ??
                DEFAULT_FORM_SETTINGS.theme.spacing ??
                "normal"
              }
              options={FORM_SPACING_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                description: `${option.px}px rhythm`,
              }))}
              onChange={(spacing) =>
                updateTheme({
                  spacing: spacing as FormSettings["theme"]["spacing"],
                })
              }
            />
          </JoyCardContent>
        </JoyCard>

        <JoyCard>
          <JoyCardHeader
            startDecorator={
              <Avatar size="sm" variant="soft" color="neutral">
                <Layout size={18} />
              </Avatar>
            }
            title="Layout and behavior"
            description="Choose width, field density, button treatment, and success messaging."
          />
          <JoyCardContent sx={{ pt: 3, gap: 2.5 }}>
            <OptionCardGroup
              label="Form width"
              helperText="Controls the overall reading measure for the public form."
              value={
                normalizedSettings.form_width ??
                DEFAULT_FORM_SETTINGS.form_width ??
                "medium"
              }
              options={FORM_WIDTH_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                description: option.description,
              }))}
              onChange={(form_width) =>
                updateSettings({
                  form_width: form_width as FormSettings["form_width"],
                })
              }
            />

            <OptionCardGroup
              label="Button style"
              helperText="Sets the visual weight of the primary submit action."
              value={
                normalizedSettings.theme.button_style ??
                DEFAULT_FORM_SETTINGS.theme.button_style ??
                "filled"
              }
              options={FORM_BUTTON_STYLE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                description: option.description,
              }))}
              onChange={(button_style) =>
                updateTheme({
                  button_style:
                    button_style as FormSettings["theme"]["button_style"],
                })
              }
            />

            <OptionCardGroup
              label="Input style"
              helperText="Controls field outlines and emphasis."
              value={
                normalizedSettings.theme.input_style ??
                DEFAULT_FORM_SETTINGS.theme.input_style ??
                "outlined"
              }
              options={FORM_INPUT_STYLE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                description: option.description,
              }))}
              onChange={(input_style) =>
                updateTheme({
                  input_style:
                    input_style as FormSettings["theme"]["input_style"],
                })
              }
            />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              <JoySelect
                label="Label position"
                value={normalizedSettings.label_position ?? "top"}
                options={LABEL_POSITION_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onValueChange={(label_position) =>
                  updateSettings({
                    label_position:
                      label_position as FormSettings["label_position"],
                  })
                }
              />
              <JoySelect
                label="Columns"
                value={String(normalizedSettings.columns ?? 1)}
                options={COLUMN_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onValueChange={(columns) =>
                  updateSettings({
                    columns: Number(columns) as FormSettings["columns"],
                  })
                }
              />
            </Box>

            <JoyInput
              label="Submit button label"
              value={submitButtonTextDraft}
              onFocus={() => setIsSubmitButtonFocused(true)}
              onBlur={() => {
                setIsSubmitButtonFocused(false);
                updateSettings({ submit_button_text: submitButtonTextDraft });
              }}
              onValueChange={(submit_button_text) => {
                setSubmitButtonTextDraft(submit_button_text);
                updateRawSettings({ submit_button_text });
              }}
              placeholder="Subscribe"
            />

            <FormControl>
              <FormLabel>Success message</FormLabel>
              <Textarea
                minRows={3}
                value={successMessageDraft}
                onFocus={() => setIsSuccessMessageFocused(true)}
                onBlur={() => {
                  setIsSuccessMessageFocused(false);
                  updateSettings({ success_message: successMessageDraft });
                }}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setSuccessMessageDraft(nextValue);
                  updateRawSettings({ success_message: nextValue });
                }}
                placeholder="Thanks for joining. Check your inbox for the next update."
                sx={{ borderRadius: "lg" }}
              />
            </FormControl>

            <JoyInput
              label="Success redirect URL"
              value={successRedirectUrlDraft}
              onFocus={() => setIsSuccessRedirectFocused(true)}
              onBlur={() => {
                setIsSuccessRedirectFocused(false);
                updateSettings({
                  success_redirect_url: successRedirectUrlDraft || null,
                });
              }}
              onValueChange={(success_redirect_url) => {
                setSuccessRedirectUrlDraft(success_redirect_url);
                updateRawSettings({ success_redirect_url });
              }}
              placeholder="https://example.com/thanks"
              helperText="Optional. Leave blank to show the inline success state instead."
            />

            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 2,
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "lg",
                p: 2,
              }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  Show BloomSuite branding
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Controls whether the public runtime shows the brand footer
                  treatment.
                </Typography>
              </Stack>
              <Switch
                checked={normalizedSettings.show_branding}
                onChange={(event) =>
                  updateSettings({ show_branding: event.target.checked })
                }
              />
            </Box>
          </JoyCardContent>
        </JoyCard>
      </Stack>

      <Stack spacing={2} sx={{ position: { xl: "sticky" }, top: { xl: 24 } }}>
        <JoyCard>
          <JoyCardHeader
            startDecorator={
              <Avatar size="sm" variant="soft" color="primary">
                <Sparkles size={18} />
              </Avatar>
            }
            title="Live preview"
            description={`The public runtime updates as you tune the design${formName ? ` for ${formName}` : ""}.`}
            actions={
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <JoyChip size="sm" variant="soft" color="neutral">
                  {normalizedSettings.form_width}
                </JoyChip>
                <JoyChip size="sm" variant="soft" color="neutral">
                  {normalizedSettings.theme.button_style}
                </JoyChip>
              </Stack>
            }
          />
          <JoyCardContent sx={{ pt: 3, gap: 2 }}>
            <Sheet
              variant="plain"
              sx={{
                borderRadius: "xl",
                p: { xs: 1.5, md: 2 },
                background:
                  "linear-gradient(180deg, rgba(15, 23, 42, 0.04) 0%, rgba(34, 197, 94, 0.06) 100%)",
                maxHeight: { xl: "calc(100vh - 180px)" },
                overflow: "auto",
              }}
            >
              <FormPreviewRenderer
                fields={fields}
                settings={normalizedSettings}
                compliance={compliance}
                uploadEmbedKey={uploadEmbedKey}
              />
            </Sheet>
          </JoyCardContent>
        </JoyCard>
      </Stack>
    </Box>
  );
}
