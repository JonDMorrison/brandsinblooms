import * as React from "react";
import Box from "@mui/joy/Box";
import { Info } from "lucide-react";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import {
  PERSONA_TOOLTIP,
  SEGMENT_TOOLTIP,
} from "@/lib/crm/copy";

/**
 * Small info-icon trigger that opens a friendly explanation of "segment" or
 * "persona". Both terms stay in the product — these tooltips earn them by
 * explaining what they mean in plain language. Keep usage to first mention on
 * any given page; don't sprinkle on every chip.
 */

type TermTooltipProps = {
  term: "segment" | "persona";
  /** Optional override — falls back to the canonical copy in copy.ts. */
  title?: string;
  /** Override accessible label; defaults to "What's a segment?" / persona. */
  ariaLabel?: string;
};

export function TermTooltip({ term, title, ariaLabel }: TermTooltipProps) {
  const resolvedTitle =
    title ?? (term === "segment" ? SEGMENT_TOOLTIP : PERSONA_TOOLTIP);
  const resolvedAriaLabel =
    ariaLabel ??
    (term === "segment" ? "What's a segment?" : "What's a persona?");

  return (
    <JoyTooltip
      title={resolvedTitle}
      placement="top"
      variant="outlined"
      color="neutral"
      arrow
      sx={{
        maxWidth: 320,
        backgroundColor: "#FFFFFF",
        color: "#1F4341",
        fontSize: "13px",
        lineHeight: 1.45,
        boxShadow: "var(--joy-shadow-md)",
        border: "1px solid",
        borderColor: "neutral.200",
        p: 1.25,
        "--variant-borderWidth": "1px",
      }}
    >
      <Box
        component="span"
        role="button"
        tabIndex={0}
        aria-label={resolvedAriaLabel}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          color: "neutral.500",
          cursor: "help",
          borderRadius: "50%",
          ml: 0.5,
          "&:hover": { color: "neutral.700" },
          "&:focus-visible": {
            outline: "2px solid var(--joy-palette-primary-400)",
            outlineOffset: "1px",
          },
          "& > .lucide": {
            width: 14,
            height: 14,
          },
        }}
      >
        <Info aria-hidden="true" />
      </Box>
    </JoyTooltip>
  );
}
