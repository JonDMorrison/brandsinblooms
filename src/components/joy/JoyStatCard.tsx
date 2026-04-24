import * as React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import type { ColorPaletteProp, SxProps } from "@mui/joy/styles/types";
import Typography from "@mui/joy/Typography";
import { TrendingDown, TrendingUp } from "lucide-react";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";

export type JoyStatCardProps = {
  icon: React.ReactNode;
  iconColor?: ColorPaletteProp;
  value: React.ReactNode;
  label: React.ReactNode;
  change?: {
    value: string;
    direction: "up" | "down";
  };
  onClick?: () => void;
  sx?: SxProps;
};

export function JoyStatCard({
  icon,
  iconColor = "primary",
  value,
  label,
  change,
  onClick,
  sx,
}: JoyStatCardProps) {
  const isInteractive = Boolean(onClick);
  const changeColor = change?.direction === "down" ? "danger" : "success";
  const ChangeIcon = change?.direction === "down" ? TrendingDown : TrendingUp;

  return (
    <JoyCard
      interactive={isInteractive}
      onClick={onClick}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      sx={sx}
    >
      <JoyCardContent sx={{ pt: 4 }}>
        <Stack
          direction="row"
          spacing={2}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack spacing={0.75}>
            <Typography level="body-xs" color="neutral">
              {label}
            </Typography>
            <Typography
              level="h2"
              sx={{
                fontFamily: "var(--joy-fontFamily-display)",
                fontSize: { xs: "1.75rem", md: "2rem" },
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "neutral.900",
              }}
            >
              {value}
            </Typography>
            {change ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ChangeIcon size={14} strokeWidth={1.9} />
                <Typography level="body-xs" color={changeColor}>
                  {change.value}
                </Typography>
              </Stack>
            ) : null}
          </Stack>
          <Sheet
            variant="soft"
            color={iconColor}
            sx={{
              width: 40,
              height: 40,
              borderRadius: "999px",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              "& > *": {
                width: 20,
                height: 20,
              },
            }}
          >
            {icon}
          </Sheet>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
