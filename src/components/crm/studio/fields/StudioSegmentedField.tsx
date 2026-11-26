import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { LucideIcon } from "lucide-react";

export type StudioSegmentedOption<T extends string> = {
  value: T;
  /** Read by screen readers and shown as the hover hint. */
  label: string;
  icon: LucideIcon;
};

type StudioSegmentedFieldProps<T extends string> = {
  label: string;
  value: T;
  options: ReadonlyArray<StudioSegmentedOption<T>>;
  onChange: (value: T) => void;
};

/**
 * One row of icon buttons where exactly one is on. Every alignment control in
 * the Design Studio is built from this, so Left / Centre / Right looks and
 * behaves the same in every block.
 */
export default function StudioSegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: StudioSegmentedFieldProps<T>) {
  const groupId = React.useId();
  return (
    <Stack spacing={0.5}>
      <Typography
        id={groupId}
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
        role="group"
        aria-labelledby={groupId}
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
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
          const selected = value === optionValue;
          return (
            <IconButton
              key={optionValue}
              variant="plain"
              color="neutral"
              size="sm"
              aria-label={optionLabel}
              aria-pressed={selected}
              title={optionLabel}
              onClick={() => onChange(optionValue)}
              sx={{
                width: 30,
                height: 30,
                minWidth: 30,
                minHeight: 30,
                borderRadius: "8px",
                color: selected ? "primary.600" : "neutral.500",
                bgcolor: selected ? "#ffffff" : "transparent",
                boxShadow: selected
                  ? "0 1px 3px rgba(15, 23, 42, 0.12), 0 0 0 1px var(--joy-palette-primary-100)"
                  : "none",
                transition:
                  "background-color 140ms ease, color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
                "&:hover": {
                  color: selected ? "primary.700" : "neutral.700",
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
