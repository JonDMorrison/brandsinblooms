import React from "react";
import type { LucideIcon } from "lucide-react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

import { cn } from "@/lib/utils";

interface CRMMetricCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: LucideIcon;
  iconClassName: string;
  iconWrapClassName: string;
  appearance?: "default" | "flat";
  valueClassName?: string;
  subtitleClassName?: string;
  className?: string;
}

export function CRMMetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  iconWrapClassName,
  appearance = "default",
  valueClassName,
  subtitleClassName,
  className,
}: CRMMetricCardProps) {
  return (
    <Sheet
      variant="outlined"
      className={className}
      sx={{
        height: "100%",
        minHeight: 152,
        borderRadius: "lg",
        bgcolor: "background.surface",
        p: 2.5,
      }}
    >
      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Typography
            level="body-xs"
            sx={{
              color: "text.tertiary",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
            }}
          >
            {label}
          </Typography>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.tertiary",
              flexShrink: 0,
            }}
          >
            <Icon size={20} className={cn(iconClassName, iconWrapClassName)} />
          </Box>
        </Stack>

        <Box sx={{ flex: 1 }}>
          {React.isValidElement(value) ? (
            value
          ) : (
            <Typography
              level="h3"
              className={valueClassName}
              sx={{
                color:
                  value === null || value === undefined || value === ""
                    ? "text.disabled"
                    : "text.primary",
                wordBreak: "break-word",
              }}
            >
              {value || "—"}
            </Typography>
          )}
        </Box>

        {subtitle ? (
          <Typography
            level="body-xs"
            className={subtitleClassName}
            sx={{ color: "text.tertiary" }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
    </Sheet>
  );
}
