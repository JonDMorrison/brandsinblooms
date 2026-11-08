import type { SxProps } from "@mui/joy/styles/types";

/**
 * Support Desk type scale and control sizing.
 *
 * These selectors outrank a component's own single-class sx. To size one
 * element differently, use "&&&" in its sx.
 *
 * The global Joy theme sets body text to 14px, which is too small for a page
 * people read all day. These overrides apply only inside the Support Desk root,
 * so other CRM pages keep the global scale.
 */
export const deskScaleSx: SxProps = {
  fontFamily: "var(--joy-fontFamily-body)",
  "& .MuiTypography-h1": { fontSize: { xs: "1.75rem", md: "2rem" }, lineHeight: 1.2, letterSpacing: "-0.02em" },
  "& .MuiTypography-h2": { fontSize: { xs: "1.5rem", md: "1.75rem" }, lineHeight: 1.25, letterSpacing: "-0.015em" },
  "& .MuiTypography-h3": { fontSize: "1.25rem", lineHeight: 1.3 },
  "& .MuiTypography-h4": { fontSize: "1.125rem", lineHeight: 1.35 },
  "& .MuiTypography-title-lg": { fontSize: "1.25rem", lineHeight: 1.35 },
  "& .MuiTypography-title-md": { fontSize: "1.0625rem", lineHeight: 1.4 },
  "& .MuiTypography-title-sm": { fontSize: "1rem", lineHeight: 1.4 },
  "& .MuiTypography-body-lg": { fontSize: "1.125rem", lineHeight: 1.6 },
  "& .MuiTypography-body-md": { fontSize: "1rem", lineHeight: 1.6 },
  "& .MuiTypography-body-sm": { fontSize: "0.9375rem", lineHeight: 1.55 },
  "& .MuiTypography-body-xs": { fontSize: "0.8125rem", lineHeight: 1.5 },
  "& .MuiButton-root": { minHeight: 44, fontSize: "1rem" },
  "& .MuiButton-sizeSm": { minHeight: 40, fontSize: "0.9375rem" },
  "& .MuiIconButton-root": { minWidth: 44, minHeight: 44 },
  "& .MuiInput-root, & .MuiSelect-root": { minHeight: 44, fontSize: "1rem" },
  "& .MuiTextarea-root": { fontSize: "1rem" },
  "& :is(a, button, [role='button'], [role='tab'], summary):focus-visible": {
    outline: "3px solid var(--joy-palette-primary-500)",
    outlineOffset: "2px",
  },
};

/** A card surface with gentle depth, used across the redesigned desk. */
export const deskCardSx = {
  borderRadius: "xl",
  bgcolor: "background.surface",
  border: "1px solid",
  borderColor: "neutral.200",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.04)",
} as const;
