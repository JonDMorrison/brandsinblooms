import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { ArrowRight, Palette } from "lucide-react";

export interface StudioCtaCardProps {
  onOpen: () => void;
  disabled?: boolean;
  disabledReason?: string;
  /** Override the default copy when Studio is opening a sent campaign. */
  title?: string;
  subtitle?: string;
}

export function StudioCtaCard({
  onOpen,
  disabled = false,
  disabledReason,
  title = "Open the Design Studio",
  subtitle = "Edit text, add images, change layouts, design your email",
}: StudioCtaCardProps) {
  const handleClick = () => {
    if (disabled) return;
    onOpen();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  const card = (
    <Box
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={title}
      data-testid="studio-cta-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        width: "100%",
        px: 2.75,
        py: 2.5,
        borderRadius: "var(--joy-radius-lg)",
        backgroundColor: "var(--joy-palette-primary-500)",
        color: "var(--joy-palette-common-white, #ffffff)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition:
          "transform 150ms ease, filter 150ms ease, box-shadow 150ms ease",
        boxShadow: disabled ? "none" : "var(--joy-shadow-sm)",
        "&:hover": disabled
          ? {}
          : {
              transform: "translateY(-1px)",
              filter: "brightness(1.04)",
              boxShadow: "var(--joy-shadow-md)",
            },
        "&:focus-visible": {
          outline: "2px solid var(--joy-palette-primary-200)",
          outlineOffset: "2px",
        },
        "&:hover [data-cta-arrow], &:focus-visible [data-cta-arrow]": disabled
          ? {}
          : {
              transform: "translateX(3px)",
            },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: "var(--joy-radius-md)",
          backgroundColor: "var(--joy-palette-common-white, #ffffff)",
          color: "var(--joy-palette-primary-600)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Palette size={22} strokeWidth={1.8} />
      </Box>
      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          component="span"
          sx={{
            fontSize: "17px",
            fontWeight: 500,
            lineHeight: 1.2,
            color: "inherit",
          }}
        >
          {title}
        </Typography>
        <Typography
          component="span"
          sx={{
            fontSize: "13px",
            lineHeight: 1.4,
            color: "rgba(255, 255, 255, 0.78)",
          }}
        >
          {subtitle}
        </Typography>
      </Stack>
      <Box
        aria-hidden
        data-cta-arrow
        sx={{
          flexShrink: 0,
          display: "inline-flex",
          color: "inherit",
          transition: "transform 150ms ease",
        }}
      >
        <ArrowRight size={22} strokeWidth={2} />
      </Box>
    </Box>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip title={disabledReason} placement="top" variant="soft">
        <Box sx={{ width: "100%" }}>{card}</Box>
      </Tooltip>
    );
  }

  return card;
}
