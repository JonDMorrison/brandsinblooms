import * as React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

export type JoyPageHeaderBandProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  metadata?: React.ReactNode;
  actions?: React.ReactNode;
  sx?: SxProps;
  contentSx?: SxProps;
};

export function JoyPageHeaderBand({
  title,
  description,
  metadata,
  actions,
  sx,
  contentSx,
}: JoyPageHeaderBandProps) {
  return (
    <Sheet
      variant="plain"
      sx={mergeSx(
        {
          px: { xs: 4, md: 6 },
          py: 5,
          borderRadius: "var(--joy-radius-xl)",
          background:
            "linear-gradient(135deg, var(--joy-palette-primary-50) 0%, var(--joy-palette-sand-50) 100%)",
        },
        sx,
      )}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", lg: "center" }}
        sx={contentSx}
      >
        <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            level="h3"
            sx={{
              fontFamily: "var(--joy-fontFamily-body)",
              fontSize: "24px",
              fontWeight: 700,
              lineHeight: 1.2,
              color: "neutral.900",
            }}
          >
            {title}
          </Typography>
          {description ? (
            <Typography
              level="body-sm"
              sx={{
                maxWidth: 600,
                color: "neutral.600",
              }}
            >
              {description}
            </Typography>
          ) : null}
          {metadata ? (
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              flexWrap="wrap"
              sx={{ minHeight: 18 }}
            >
              {metadata}
            </Stack>
          ) : null}
        </Stack>

        {actions ? (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            useFlexGap
            sx={{
              alignSelf: { xs: "stretch", lg: "center" },
              width: { xs: "100%", lg: "auto" },
            }}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Sheet>
  );
}
