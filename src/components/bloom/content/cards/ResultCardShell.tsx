import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

interface ResultCardShellProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  meta?: React.ReactNode;
  title: string;
}

export function ResultCardShell({
  children,
  icon,
  meta,
  title,
}: ResultCardShellProps) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        my: 1.5,
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        borderRadius: "var(--joy-radius-lg)",
        backgroundColor: "background.surface",
        boxShadow: "none",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: "1px solid",
          borderColor: "neutral.outlinedBorder",
          backgroundColor: "neutral.50",
        }}
      >
        <Box
          sx={{ display: "inline-flex", color: "neutral.600", flexShrink: 0 }}
        >
          {icon}
        </Box>
        <Typography
          level="body-xs"
          sx={{
            color: "neutral.600",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </Typography>
        {meta ? (
          <Typography
            level="body-xs"
            sx={{
              color: "neutral.400",
              ml: "auto",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {meta}
          </Typography>
        ) : null}
      </Stack>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Sheet>
  );
}
