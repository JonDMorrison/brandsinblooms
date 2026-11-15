import type { SxProps } from "@mui/joy/styles/types";

const reducedMotion = "@media (prefers-reduced-motion: reduce)";

/** Calm surface that lifts slightly on hover. */
export const interactiveSurfaceSx: SxProps = {
  borderRadius: "20px",
  borderColor: "neutral.outlinedBorder",
  bgcolor: "background.surface",
  boxShadow: "none",
  transition: "box-shadow 180ms ease, border-color 180ms ease",
  "&:hover": {
    boxShadow: "sm",
    borderColor: "neutral.outlinedHoverBorder",
  },
  [reducedMotion]: { transition: "none" },
};

/** Soft press feedback for buttons inside the connections surface. */
export const softPressSx: SxProps = {
  transition: "transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease",
  "&:active:not(:disabled)": { transform: "scale(0.97)" },
  [reducedMotion]: {
    transition: "none",
    "&:active:not(:disabled)": { transform: "none" },
  },
};
