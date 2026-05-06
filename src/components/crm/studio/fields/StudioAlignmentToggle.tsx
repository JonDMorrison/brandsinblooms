import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";

type AlignmentValue = "left" | "center" | "right";

type StudioAlignmentToggleProps = {
  label: string;
  defaultValue?: AlignmentValue;
  value?: AlignmentValue;
  onChange?: (value: AlignmentValue) => void;
};

export default function StudioAlignmentToggle({
  label,
  defaultValue = "left",
  value,
  onChange,
}: StudioAlignmentToggleProps) {
  const [internalValue, setInternalValue] =
    React.useState<AlignmentValue>(defaultValue);
  const resolvedValue = value ?? internalValue;

  const commitValue = React.useCallback(
    (nextValue: AlignmentValue) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }

      onChange?.(nextValue);
    },
    [onChange, value],
  );

  return (
    <Stack spacing={0.5}>
      <Typography
        level="body-xs"
        sx={{
          fontSize: "12px",
          fontWeight: 650,
          letterSpacing: "0.01em",
          color: "neutral.700",
        }}
      >
        {label}
      </Typography>
      <Sheet
        sx={{
          bgcolor: "neutral.50",
          border: "1px solid",
          borderColor: "neutral.200",
          borderRadius: "10px",
          p: "3px",
          display: "flex",
          gap: "3px",
          width: "fit-content",
        }}
      >
        {(
          [
            ["left", AlignLeft],
            ["center", AlignCenter],
            ["right", AlignRight],
          ] as const
        ).map(([nextValue, Icon]) => {
          const selected = resolvedValue === nextValue;

          return (
            <IconButton
              key={nextValue}
              variant="plain"
              color="neutral"
              size="sm"
              aria-label={`${nextValue} align`}
              onClick={() => commitValue(nextValue)}
              sx={{
                width: 30,
                height: 30,
                minWidth: 30,
                minHeight: 30,
                borderRadius: "8px",
                color: selected ? "primary.600" : "neutral.400",
                bgcolor: selected ? "#ffffff" : "transparent",
                boxShadow: selected
                  ? "0 1px 3px rgba(15, 23, 42, 0.12), 0 0 0 1px var(--joy-palette-primary-100)"
                  : "none",
                transition:
                  "background-color 140ms ease, color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
                "&:hover": {
                  color: selected ? "primary.700" : "neutral.600",
                  bgcolor: selected ? "#ffffff" : "neutral.100",
                },
                "&:active": { transform: "scale(0.96)" },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.400",
                  outlineOffset: 2,
                },
              }}
            >
              <Box sx={{ display: "flex" }}>
                <Icon size={15} />
              </Box>
            </IconButton>
          );
        })}
      </Sheet>
    </Stack>
  );
}
