import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useTheme } from "@mui/joy/styles";
import { Check, ChevronDown } from "lucide-react";
import { useOptionalDesignSystem } from "@/contexts/DesignSystemContext";

const CORE_COLOR_PRESETS = [
  "#1E3A8A",
  "#E76F51",
  "#2E7D32",
  "#374151",
  "#FFFFFF",
];

const MORE_COLOR_PRESETS = [
  "#F8FAFC",
  "#E11D48",
  "#F97316",
  "#FACC15",
  "#84CC16",
  "#10B981",
  "#06B6D4",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#111827",
];

type StudioColorPickerProps = {
  label: string;
  defaultColor?: string;
  value?: string;
  onChange?: (value: string) => void;
  presets?: string[];
  expandedPresets?: string[];
};

export default function StudioColorPicker({
  label,
  defaultColor,
  value,
  onChange,
  presets,
  expandedPresets,
}: StudioColorPickerProps) {
  const theme = useTheme();
  const designSystemContext = useOptionalDesignSystem();
  const designSystemPresets = designSystemContext?.designSystem.colorPresets;
  const primaryPreset = theme.palette.primary[500];
  const colorPresets = React.useMemo(() => {
    if (presets && presets.length > 0) {
      return presets;
    }

    if (designSystemPresets?.core.length) {
      return Array.from(
        new Set([
          ...designSystemPresets.core,
          primaryPreset,
          ...CORE_COLOR_PRESETS,
        ]),
      );
    }

    return [primaryPreset, ...CORE_COLOR_PRESETS];
  }, [designSystemPresets?.core, presets, primaryPreset]);
  const additionalPresets = React.useMemo(
    () =>
      expandedPresets ??
      (designSystemPresets?.expanded.length
        ? Array.from(
            new Set([...designSystemPresets.expanded, ...MORE_COLOR_PRESETS]),
          )
        : MORE_COLOR_PRESETS),
    [designSystemPresets?.expanded, expandedPresets],
  );
  const [expanded, setExpanded] = React.useState(false);
  const [selectedColor, setSelectedColor] = React.useState(
    defaultColor ?? primaryPreset,
  );
  const resolvedColor = value ?? selectedColor;

  const commitColor = React.useCallback(
    (nextColor: string) => {
      if (value === undefined) {
        setSelectedColor(nextColor);
      }

      onChange?.(nextColor);
    },
    [onChange, value],
  );

  return (
    <Stack spacing={0.75} sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
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
      <Stack
        spacing={0.75}
        sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          useFlexGap
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            flexWrap: "wrap",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {[...colorPresets, ...(expanded ? additionalPresets : [])].map(
            (color) => {
              const isSelected =
                resolvedColor.toLowerCase() === color.toLowerCase();
              const isLight = ["#ffffff", "#fff", "#f8fafc"].includes(
                color.toLowerCase(),
              );

              return (
                <IconButton
                  key={color}
                  variant="plain"
                  color="neutral"
                  size="sm"
                  aria-label={`Select ${color} for ${label}`}
                  aria-pressed={isSelected}
                  onClick={() => commitColor(color)}
                  sx={{
                    width: 24,
                    height: 24,
                    minWidth: 24,
                    minHeight: 24,
                    p: 0,
                    borderRadius: "50%",
                    bgcolor: color,
                    color: isLight ? "primary.700" : "#ffffff",
                    border: "1px solid",
                    borderColor: isLight ? "neutral.200" : "transparent",
                    outline: isSelected ? "2px solid" : "0 solid transparent",
                    outlineColor: isSelected ? "primary.400" : "transparent",
                    outlineOffset: "2px",
                    boxShadow: isSelected
                      ? "0 0 0 4px var(--joy-palette-primary-100)"
                      : "none",
                    transition:
                      "transform 140ms ease, box-shadow 140ms ease, outline-color 140ms ease",
                    "&:hover": {
                      bgcolor: color,
                      transform: "scale(1.08)",
                    },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.400",
                      outlineOffset: 2,
                    },
                  }}
                >
                  {isSelected ? <Check size={13} strokeWidth={3} /> : null}
                </IconButton>
              );
            },
          )}
          {additionalPresets.length > 0 ? (
            <Button
              variant="plain"
              color="neutral"
              size="sm"
              onClick={() => setExpanded((current) => !current)}
              endDecorator={
                <ChevronDown
                  size={13}
                  style={{ transform: expanded ? "rotate(180deg)" : undefined }}
                />
              }
              sx={{
                minHeight: 26,
                px: 0.75,
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 700,
                color: expanded ? "primary.700" : "primary.600",
                bgcolor: expanded ? "primary.50" : "transparent",
                "&:hover": { bgcolor: "primary.50", color: "primary.700" },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.400",
                  outlineOffset: 2,
                },
              }}
            >
              + More
            </Button>
          ) : null}
        </Stack>
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 18,
              height: 18,
              flexShrink: 0,
              borderRadius: "5px",
              bgcolor: resolvedColor,
              border: "1px solid",
              borderColor: "neutral.200",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.6)",
            }}
          />
          <Input
            size="sm"
            variant="outlined"
            value={resolvedColor}
            onChange={(event) => commitColor(event.target.value)}
            sx={{
              flex: 1,
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              borderRadius: "10px",
              "--Input-focusedThickness": "0px",
              "--Input-focusedHighlight": "transparent",
              border: "1.5px solid",
              bgcolor: "#ffffff",
              borderColor: "neutral.200",
              fontSize: "12px",
              fontFamily: "SF Mono, Menlo, monospace",
              "--Input-minHeight": "32px",
              "&:hover:not(:focus-within)": {
                borderColor: "neutral.300",
              },
              "&:focus-within": {
                borderColor: "primary.400",
                boxShadow: "0 0 0 3px var(--joy-palette-primary-100)",
                outline: "none",
              },
              "& input": {
                minWidth: 0,
                width: "100%",
              },
              "& input:focus": {
                outline: "none",
              },
            }}
          />
        </Stack>
      </Stack>
    </Stack>
  );
}
