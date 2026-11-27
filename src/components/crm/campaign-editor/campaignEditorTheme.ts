import type { SxProps } from "@mui/joy/styles/types";

/**
 * Colours for the campaign editor page only. The global Joy theme is not
 * changed: the page root re-points the Joy palette variables below for its
 * own subtree, so every Joy warning, info and primary control on this page
 * uses these colours (no salmon warning or info surfaces here).
 */
export const CAMPAIGN_EDITOR_COLORS = {
  primary: "#1F4D3A",
  primaryHover: "#173B2C",
  primaryActive: "#112C21",
  pageBg: "#F6F5F1",
  surface: "#FFFFFF",
  cardBorder: "#E4E2DA",
  text: "#1A2320",
  muted: "#5B665F",
  infoBg: "#EAF1F7",
  infoText: "#2F5E86",
  warningBg: "#FDF3E1",
  warningText: "#6B4700",
  warningBorder: "#C98A1B",
  success: "#2E7D52",
} as const;

const C = CAMPAIGN_EDITOR_COLORS;

/** Joy palette variables for one colour family, pointed at fixed values. */
function paletteVars(
  name: "primary" | "warning" | "info" | "success",
  scale: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>,
  tokens: {
    solidBg: string;
    solidHoverBg: string;
    solidActiveBg: string;
    softBg: string;
    softColor: string;
    outlinedBorder: string;
    plainColor: string;
    outlinedColor: string;
  },
) {
  const vars: Record<string, string> = {};
  for (const [step, value] of Object.entries(scale)) {
    vars[`--joy-palette-${name}-${step}`] = value;
  }
  vars[`--joy-palette-${name}-solidBg`] = tokens.solidBg;
  vars[`--joy-palette-${name}-solidHoverBg`] = tokens.solidHoverBg;
  vars[`--joy-palette-${name}-solidActiveBg`] = tokens.solidActiveBg;
  vars[`--joy-palette-${name}-solidColor`] = "#FFFFFF";
  vars[`--joy-palette-${name}-softBg`] = tokens.softBg;
  vars[`--joy-palette-${name}-softHoverBg`] = scale[200];
  vars[`--joy-palette-${name}-softActiveBg`] = scale[300];
  vars[`--joy-palette-${name}-softColor`] = tokens.softColor;
  vars[`--joy-palette-${name}-outlinedBorder`] = tokens.outlinedBorder;
  vars[`--joy-palette-${name}-outlinedColor`] = tokens.outlinedColor;
  vars[`--joy-palette-${name}-outlinedHoverBg`] = scale[50];
  vars[`--joy-palette-${name}-outlinedHoverBorder`] = scale[400];
  vars[`--joy-palette-${name}-outlinedActiveBg`] = scale[100];
  vars[`--joy-palette-${name}-plainColor`] = tokens.plainColor;
  vars[`--joy-palette-${name}-plainHoverBg`] = scale[100];
  vars[`--joy-palette-${name}-plainActiveBg`] = scale[200];
  return vars;
}

const pageVars = {
  ...paletteVars(
    "primary",
    {
      50: "#EEF4F0",
      100: "#DCE8E0",
      200: "#B9D1C2",
      300: "#8FB39E",
      400: "#4F7D65",
      500: C.primary,
      600: C.primaryHover,
      700: C.primaryActive,
      800: "#0E241B",
      900: "#091812",
    },
    {
      solidBg: C.primary,
      solidHoverBg: C.primaryHover,
      solidActiveBg: C.primaryActive,
      softBg: "#DCE8E0",
      softColor: C.primary,
      outlinedBorder: "#8FB39E",
      plainColor: C.primary,
      outlinedColor: C.primary,
    },
  ),
  ...paletteVars(
    "warning",
    {
      50: C.warningBg,
      100: C.warningBg,
      200: "#F6DFB4",
      300: "#E5B862",
      400: C.warningBorder,
      500: C.warningBorder,
      600: "#A06D12",
      700: C.warningText,
      800: C.warningText,
      900: "#4A3100",
    },
    {
      solidBg: C.warningText,
      solidHoverBg: "#573A00",
      solidActiveBg: "#4A3100",
      softBg: C.warningBg,
      softColor: C.warningText,
      outlinedBorder: C.warningBorder,
      plainColor: C.warningText,
      outlinedColor: C.warningText,
    },
  ),
  ...paletteVars(
    "info",
    {
      50: C.infoBg,
      100: C.infoBg,
      200: "#CFE0EE",
      300: "#A6C4DD",
      400: "#6E9BC0",
      500: C.infoText,
      600: C.infoText,
      700: C.infoText,
      800: "#244A6B",
      900: "#1A3750",
    },
    {
      solidBg: C.infoText,
      solidHoverBg: "#244A6B",
      solidActiveBg: "#1A3750",
      softBg: C.infoBg,
      softColor: C.infoText,
      outlinedBorder: "#A6C4DD",
      plainColor: C.infoText,
      outlinedColor: C.infoText,
    },
  ),
  ...paletteVars(
    "success",
    {
      50: "#EAF5EE",
      100: "#D5EBDD",
      200: "#ABD6BB",
      300: "#7FBF97",
      400: "#4E9C6C",
      500: C.success,
      600: C.success,
      700: "#245F3F",
      800: "#1B4A31",
      900: "#123322",
    },
    {
      solidBg: C.success,
      solidHoverBg: "#245F3F",
      solidActiveBg: "#1B4A31",
      softBg: "#EAF5EE",
      softColor: "#1B4A31",
      outlinedBorder: "#7FBF97",
      plainColor: "#245F3F",
      outlinedColor: "#245F3F",
    },
  ),
  "--joy-palette-text-primary": C.text,
  "--joy-palette-text-secondary": C.muted,
  "--joy-palette-text-tertiary": C.muted,
  "--joy-palette-focusVisible": C.primary,
};

/**
 * The page root: local colour tokens, 44px touch targets and 16px input
 * text for every control on the page.
 */
export const campaignEditorPageSx: SxProps = {
  ...pageVars,
  color: C.text,
  "& .MuiButton-root, & .MuiIconButton-root": { minHeight: 44 },
  "& .MuiIconButton-root": { minWidth: 44 },
  "& .MuiInput-root, & .MuiSelect-root, & .MuiAutocomplete-root": {
    minHeight: 44,
  },
  // Joy inputs set 14px text on .MuiInput-input; these selectors outrank it.
  "& .MuiInput-root .MuiInput-input, & .MuiTextarea-root .MuiTextarea-textarea, & .MuiAutocomplete-root .MuiAutocomplete-input, & .MuiSelect-root .MuiSelect-button":
    { fontSize: 16 },
  "& .MuiFormLabel-root": { color: C.text, fontSize: 15, fontWeight: 600 },
  "& .MuiFormHelperText-root": { color: C.muted, fontSize: 14 },
  "& .MuiCheckbox-root": { minHeight: 44, alignItems: "center" },
};

/** A white card with the page's border colour. */
export const campaignEditorCardSx: SxProps = {
  bgcolor: C.surface,
  border: `1px solid ${C.cardBorder}`,
  borderRadius: "14px",
  boxShadow: "none",
};
