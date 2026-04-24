import * as React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { ColorPaletteProp } from "@mui/joy/styles";
import { Settings, Trash2 } from "lucide-react";

type AutomationNodeShellProps = {
  title: string;
  badge: string;
  description?: string;
  summary?: string | null;
  color: ColorPaletteProp;
  selected?: boolean;
  icon: React.ReactNode;
  borderColor: string;
  hoverBorderColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  ringColor?: string;
  onClick?: () => void;
  onEdit?: (event: React.MouseEvent) => void;
  onDelete?: (event: React.MouseEvent) => void;
  children?: React.ReactNode;
};

export function AutomationNodeShell({
  title,
  badge,
  description,
  summary,
  color,
  selected = false,
  icon,
  borderColor,
  hoverBorderColor,
  backgroundColor,
  accentColor,
  ringColor,
  onClick,
  onEdit,
  onDelete,
  children,
}: AutomationNodeShellProps) {
  return (
    <Sheet
      variant="outlined"
      onClick={onClick}
      sx={{
        borderRadius: "12px",
        border: "1.5px solid",
        borderColor,
        p: 1.75,
        pl: 2,
        width: 260,
        minWidth: 260,
        maxWidth: 260,
        backgroundColor: backgroundColor || "background.surface",
        boxShadow: selected
          ? `${ringColor || "rgba(var(--joy-palette-primary-mainChannel) / 0.16)"} 0 0 0 3px, var(--joy-shadow-md)`
          : "var(--joy-shadow-sm)",
        transition:
          "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
        cursor: "pointer",
        position: "relative",
        overflow: "visible",
        "--automation-node-accent": accentColor || borderColor,
        "&:hover": {
          boxShadow: "var(--joy-shadow-md)",
          transform: "translateY(-1px)",
          borderColor: hoverBorderColor || borderColor,
          ".automation-node-actions": {
            opacity: 1,
            pointerEvents: "auto",
          },
        },
        "& .automation-node-handle": {
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: "var(--automation-node-accent)",
          border: "2px solid var(--joy-palette-common-white)",
          boxShadow: "var(--joy-shadow-sm)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        },
        "& .automation-node-handle:hover": {
          transform: "scale(1.15)",
          boxShadow: `${ringColor || "rgba(var(--joy-palette-primary-mainChannel) / 0.18)"} 0 0 0 4px`,
        },
        animation: "automationNodeDrop 320ms cubic-bezier(0.2, 0.9, 0.2, 1)",
        "@keyframes automationNodeDrop": {
          "0%": {
            opacity: 0,
            transform: "scale(0.95)",
          },
          "65%": {
            opacity: 1,
            transform: "scale(1.02)",
          },
          "100%": {
            opacity: 1,
            transform: "scale(1)",
          },
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          borderTopLeftRadius: "12px",
          borderBottomLeftRadius: "12px",
          backgroundColor: accentColor || borderColor,
        }}
      />

      <Stack spacing={1.25}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Chip
            size="sm"
            variant="soft"
            color={color}
            sx={{
              fontSize: "10px",
              fontWeight: "var(--joy-fontWeight-lg)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {badge}
          </Chip>

          <Stack
            direction="row"
            spacing={0.25}
            className="automation-node-actions"
            sx={{
              opacity: selected ? 1 : 0,
              pointerEvents: selected ? "auto" : "none",
              transition: "opacity 0.15s ease",
            }}
          >
            <IconButton
              variant="soft"
              color="neutral"
              size="sm"
              onClick={onEdit}
              aria-label={`Configure ${badge.toLowerCase()} node`}
            >
              <Settings size={14} />
            </IconButton>
            <IconButton
              variant="soft"
              color="neutral"
              size="sm"
              onClick={onDelete}
              aria-label={`Delete ${badge.toLowerCase()} node`}
            >
              <Trash2 size={14} />
            </IconButton>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: accentColor || borderColor,
              mt: 0.125,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography level="title-sm" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
        </Stack>

        {description ? (
          <Typography
            level="body-xs"
            sx={{
              color: "neutral.500",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </Typography>
        ) : null}

        {summary ? (
          <Sheet
            variant="soft"
            color="neutral"
            sx={{
              px: 1,
              py: 0.625,
              borderRadius: "sm",
              alignSelf: "stretch",
            }}
          >
            <Typography level="body-xs" sx={{ fontFamily: "monospace" }}>
              {summary}
            </Typography>
          </Sheet>
        ) : null}

        {children ? <Box>{children}</Box> : null}
      </Stack>
    </Sheet>
  );
}
