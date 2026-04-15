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
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack
          direction="row"
          spacing={2}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack spacing={0.75}>
            <Typography level="body-sm" color="neutral">
              {label}
            </Typography>
            <Typography
              level="h2"
              sx={{ lineHeight: 1.05, letterSpacing: "-0.02em" }}
            >
              {value}
            </Typography>
            {change ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ChangeIcon className="h-3.5 w-3.5" />
                <Typography level="body-sm" color={changeColor}>
                  {change.value}
                </Typography>
              </Stack>
            ) : null}
          </Stack>
          <Sheet
            variant="soft"
            color={iconColor}
            sx={{
              width: 48,
              height: 48,
              borderRadius: "999px",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              "& > *": {
                width: 22,
                height: 22,
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
