import * as React from "react";
import Slider from "@mui/joy/Slider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

type StudioSliderFieldProps = {
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  value?: number;
  onChange?: (value: number) => void;
};

export default function StudioSliderField({
  label,
  min,
  max,
  step = 1,
  defaultValue,
  value,
  onChange,
}: StudioSliderFieldProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const resolvedValue = value ?? internalValue;

  const commitValue = React.useCallback(
    (nextValue: number) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }

      onChange?.(nextValue);
    },
    [onChange, value],
  );

  return (
    <Stack spacing={0.75}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
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
        <Typography
          level="body-xs"
          sx={{
            color: "neutral.500",
            fontSize: "11px",
            fontFamily: "SF Mono, Menlo, monospace",
            minWidth: 36,
            textAlign: "right",
          }}
        >
          {resolvedValue}
        </Typography>
      </Stack>
      <Slider
        size="sm"
        min={min}
        max={max}
        step={step}
        value={resolvedValue}
        onChange={(_event, nextValue) => commitValue(nextValue as number)}
        sx={{
          "--Slider-trackSize": "4px",
          "--Slider-thumbSize": "16px",
          color: "primary.400",
          py: 1,
          "& .JoySlider-rail": {
            bgcolor: "neutral.100",
            borderRadius: "999px",
          },
          "& .JoySlider-track": {
            bgcolor: "primary.400",
            borderRadius: "999px",
          },
          "& .JoySlider-thumb": {
            bgcolor: "#ffffff",
            boxShadow:
              "0 1px 4px rgba(15, 23, 42, 0.2), 0 0 0 4px var(--joy-palette-primary-100)",
            border: "2px solid",
            borderColor: "primary.400",
            transition: "box-shadow 140ms ease, transform 140ms ease",
            "&:hover": {
              boxShadow:
                "0 2px 7px rgba(15, 23, 42, 0.22), 0 0 0 5px var(--joy-palette-primary-100)",
            },
            "&:active": { transform: "scale(0.94)" },
          },
        }}
      />
    </Stack>
  );
}
