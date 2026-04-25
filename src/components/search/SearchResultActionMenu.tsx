import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Check } from "lucide-react";

import type { PaletteExecutableAction } from "@/components/search/searchActionRegistry";

interface SearchResultActionMenuProps {
  actions: PaletteExecutableAction[];
  activeActionIndex: number;
  copiedActionId?: string | null;
  errorMessage?: string;
  labelledById?: string;
  menuId?: string;
  pendingActionId?: string | null;
  onHoverAction: (index: number) => void;
  onSelectAction: (action: PaletteExecutableAction) => void;
}

export function SearchResultActionMenu({
  actions,
  activeActionIndex,
  copiedActionId,
  errorMessage,
  labelledById,
  menuId,
  pendingActionId,
  onHoverAction,
  onSelectAction,
}: SearchResultActionMenuProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <Stack spacing={0.75} sx={{ pl: 6.25, pr: 1.5, pb: 0.5, pt: 0.25 }}>
      <Sheet
        id={menuId}
        role="menu"
        aria-labelledby={labelledById}
        variant="soft"
        sx={{
          p: 0.5,
          borderRadius: "lg",
          backgroundColor:
            "rgba(var(--joy-palette-primary-mainChannel) / 0.045)",
        }}
      >
        <Stack spacing={0.25}>
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            const isActive = activeActionIndex === index;
            const isPending = pendingActionId === action.id;
            const isCopied = copiedActionId === action.id;
            const label = isCopied ? action.successLabel ?? action.label : action.label;

            return (
              <Sheet
                key={action.id}
                component="button"
                type="button"
                role="menuitem"
                onClick={() => onSelectAction(action)}
                onFocus={() => onHoverAction(index)}
                onMouseEnter={() => onHoverAction(index)}
                onMouseDown={(event) => event.preventDefault()}
                sx={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  py: 0.875,
                  borderRadius: "md",
                  border: "1px solid transparent",
                  textAlign: "left",
                  cursor: isPending ? "progress" : "pointer",
                  backgroundColor: isActive
                    ? "rgba(var(--joy-palette-primary-mainChannel) / 0.1)"
                    : "transparent",
                  borderColor: isActive
                    ? "rgba(var(--joy-palette-primary-mainChannel) / 0.16)"
                    : "transparent",
                  transition:
                    "background-color 140ms ease, border-color 140ms ease",
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                  },
                  "&:hover": {
                    backgroundColor:
                      "rgba(var(--joy-palette-primary-mainChannel) / 0.08)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "10px",
                    color: isCopied ? "success.700" : isActive ? "primary.700" : "neutral.600",
                    backgroundColor: isCopied
                      ? "rgba(var(--joy-palette-success-mainChannel) / 0.12)"
                      : isActive
                        ? "rgba(var(--joy-palette-primary-mainChannel) / 0.12)"
                        : "rgba(var(--joy-palette-neutral-mainChannel) / 0.06)",
                  }}
                >
                  {isCopied ? (
                    <Check size={15} strokeWidth={2} />
                  ) : (
                    <ActionIcon size={15} strokeWidth={1.9} />
                  )}
                </Box>

                <Typography level="body-sm" sx={{ fontWeight: 600, color: "neutral.800" }}>
                  {label}
                </Typography>

                {isPending ? (
                  <CircularProgress size="sm" thickness={2} />
                ) : null}
              </Sheet>
            );
          })}
        </Stack>
      </Sheet>

      {errorMessage ? (
        <Alert
          color="danger"
          startDecorator={<AlertTriangle size={16} strokeWidth={1.9} />}
          sx={{ alignItems: "flex-start" }}
        >
          {errorMessage}
        </Alert>
      ) : null}
    </Stack>
  );
}