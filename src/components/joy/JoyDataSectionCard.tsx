import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

export type JoyDataSectionCardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  controls?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  sx?: SxProps;
  headerSx?: SxProps;
  controlsSx?: SxProps;
  bodySx?: SxProps;
};

export function JoyDataSectionCard({
  title,
  description,
  icon,
  headerActions,
  controls,
  footer,
  children,
  sx,
  headerSx,
  controlsSx,
  bodySx,
}: JoyDataSectionCardProps) {
  const hasHeader = Boolean(title || description || icon || headerActions);

  return (
    <Sheet
      variant="outlined"
      sx={mergeSx(
        {
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          boxShadow: "none",
          overflow: "hidden",
        },
        sx,
      )}
    >
      {hasHeader ? (
        <Stack
          direction="row"
          spacing={3}
          justifyContent="space-between"
          alignItems="flex-start"
          sx={mergeSx({ px: 4, py: 4 }, headerSx)}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            {icon ? (
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "primary.600",
                  flexShrink: 0,
                  "& > .lucide": {
                    width: 20,
                    height: 20,
                  },
                }}
              >
                {icon}
              </Box>
            ) : null}
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              {title ? (
                <Typography
                  level="title-md"
                  sx={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "neutral.900",
                  }}
                >
                  {title}
                </Typography>
              ) : null}
              {description ? (
                <Typography
                  level="body-xs"
                  sx={{
                    color: "neutral.500",
                  }}
                >
                  {description}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
          {headerActions ? (
            <Box sx={{ flexShrink: 0 }}>{headerActions}</Box>
          ) : null}
        </Stack>
      ) : null}

      {hasHeader && (controls || children || footer) ? (
        <Divider
          sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-200)" }}
        />
      ) : null}

      {controls ? (
        <>
          <Box sx={mergeSx({ px: 4, py: 4 }, controlsSx)}>{controls}</Box>
          {children || footer ? (
            <Divider
              sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-200)" }}
            />
          ) : null}
        </>
      ) : null}

      {children ? (
        <Box sx={mergeSx({ width: "100%" }, bodySx)}>{children}</Box>
      ) : null}

      {footer ? (
        <>
          {children ? (
            <Divider
              sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-200)" }}
            />
          ) : null}
          <Box sx={{ px: 4, py: 4 }}>{footer}</Box>
        </>
      ) : null}
    </Sheet>
  );
}
