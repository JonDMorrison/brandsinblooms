import type { SxProps } from "@mui/joy/styles/types";

/**
 * Sizing rules for the campaign editor page. Colours, fonts and radii all
 * come from the global Joy theme (src/config/joy-theme.ts); this file only
 * sets the page's 44px touch targets, 16px input text and label sizes.
 */
export const campaignEditorPageSx: SxProps = {
  color: "text.primary",
  "& .MuiButton-root, & .MuiIconButton-root": { minHeight: 44 },
  "& .MuiIconButton-root": { minWidth: 44 },
  "& .MuiInput-root, & .MuiSelect-root, & .MuiAutocomplete-root": {
    minHeight: 44,
  },
  // Joy inputs set 14px text on .MuiInput-input; these selectors outrank it.
  "& .MuiInput-root .MuiInput-input, & .MuiTextarea-root .MuiTextarea-textarea, & .MuiAutocomplete-root .MuiAutocomplete-input, & .MuiSelect-root .MuiSelect-button":
    { fontSize: 16 },
  "& .MuiFormLabel-root": { color: "text.primary", fontSize: 15, fontWeight: 600 },
  "& .MuiFormHelperText-root": { color: "text.secondary", fontSize: 14 },
  "& .MuiCheckbox-root": { minHeight: 44, alignItems: "center" },
};

/** A surface card with the theme's divider border. */
export const campaignEditorCardSx: SxProps = {
  bgcolor: "background.surface",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "lg",
  boxShadow: "none",
};

/**
 * Spacing on the theme's 4px unit (src/config/joy-theme.ts spacingScale), so
 * 4 = 16px and 6 = 24px. Every editor card pads by the same amount, and the
 * cards sit 16px apart.
 */
export const campaignEditorCardPadding = 6;
export const campaignEditorCardGap = 4;

/** Hides text visually while keeping it for screen readers and queries. */
export const campaignEditorVisuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

/** A 3px focus outline in the theme's primary colour. */
export const campaignEditorFocusOutline = "3px solid var(--joy-palette-primary-500)";
