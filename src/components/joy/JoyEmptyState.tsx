import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton, type JoyButtonProps } from "@/components/joy/JoyButton";

type EmptyStateAction = JoyButtonProps & {
  label: React.ReactNode;
};

export type JoyEmptyStateProps = {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
};

export function JoyEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: JoyEmptyStateProps) {
  return (
    <Stack
      spacing={4}
      alignItems="center"
      justifyContent="center"
      sx={{ px: 6, py: 8, textAlign: "center" }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          display: "grid",
          placeItems: "center",
          color: "neutral.300",
          "& > .lucide": {
            width: 48,
            height: 48,
          },
          "& > .MuiSvgIcon-root": {
            fontSize: 48,
          },
        }}
      >
        {icon}
      </Box>

      <Stack spacing={1} sx={{ maxWidth: 420 }}>
        <Typography level="title-md" sx={{ color: "neutral.800" }}>
          {title}
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {description}
        </Typography>
      </Stack>

      {primaryAction || secondaryAction ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap>
          {primaryAction ? (
            <JoyButton {...primaryAction}>{primaryAction.label}</JoyButton>
          ) : null}
          {secondaryAction ? (
            <JoyButton {...secondaryAction}>{secondaryAction.label}</JoyButton>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
