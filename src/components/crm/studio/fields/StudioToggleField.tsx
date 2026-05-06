import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

type ToggleOption = {
  label: string;
  value: string;
  icon?: React.ReactNode;
  visual?: React.ReactNode;
};

type StudioToggleFieldProps = {
  label: string;
  options: ToggleOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  fullWidth?: boolean;
  layout?: "inline" | "stacked";
  iconPlacement?: "start" | "top";
};

export default function StudioToggleField({
  label,
  options,
  defaultValue,
  value,
  onChange,
  fullWidth = true,
  layout = "inline",
  iconPlacement = "start",
}: StudioToggleFieldProps) {
  const fallbackValue = defaultValue ?? options[0]?.value ?? "";
  const [internalValue, setInternalValue] = React.useState(fallbackValue);
  const selectedValue = value ?? internalValue;
  const shouldWrap = fullWidth && options.length > 3;

  return (
    <Stack spacing={0.5} sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <Typography
        level="body-xs"
        sx={{
          maxWidth: "100%",
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
          flexWrap: shouldWrap ? "wrap" : "nowrap",
          alignItems: "stretch",
          gap: "3px",
          width: fullWidth ? "100%" : "fit-content",
          maxWidth: "100%",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {options.map((option) => {
          const isSelected = selectedValue === option.value;
          const visual = option.visual ?? option.icon;
          const showTopVisual = layout === "stacked" || iconPlacement === "top";

          return (
            <Button
              key={option.value}
              variant="plain"
              color="neutral"
              size="sm"
              aria-pressed={isSelected}
              onClick={() => {
                if (value === undefined) {
                  setInternalValue(option.value);
                }

                onChange?.(option.value);
              }}
              sx={{
                minHeight: layout === "stacked" ? 54 : 30,
                flex: fullWidth
                  ? shouldWrap
                    ? "1 1 calc(50% - 1.5px)"
                    : "1 1 0"
                  : "0 0 auto",
                minWidth: 0,
                maxWidth: "100%",
                overflow: "hidden",
                borderRadius: "8px",
                px: layout === "stacked" ? 0.75 : 1,
                py: layout === "stacked" ? 0.75 : 0.5,
                gap: showTopVisual ? 0.35 : 0.5,
                flexDirection: showTopVisual ? "column" : "row",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 650,
                color: isSelected ? "primary.600" : "neutral.600",
                bgcolor: isSelected ? "#ffffff" : "transparent",
                boxShadow: isSelected
                  ? "0 1px 3px rgba(15, 23, 42, 0.12), 0 0 0 1px var(--joy-palette-primary-100)"
                  : "none",
                transition:
                  "background-color 140ms ease, color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
                "&:hover": {
                  color: isSelected ? "primary.700" : "neutral.700",
                  bgcolor: isSelected ? "#ffffff" : "neutral.100",
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.400",
                  outlineOffset: 2,
                },
              }}
            >
              {visual ? (
                <Box
                  sx={{
                    display: "flex",
                    flexShrink: 0,
                    color: isSelected ? "primary.600" : "neutral.400",
                    transition: "color 140ms ease",
                  }}
                >
                  {visual}
                </Box>
              ) : null}
              <Box
                component="span"
                sx={{
                  display: "block",
                  minWidth: 0,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {option.label}
              </Box>
            </Button>
          );
        })}
      </Sheet>
    </Stack>
  );
}
