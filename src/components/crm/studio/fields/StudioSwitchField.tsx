import * as React from "react";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";

type StudioSwitchFieldProps = {
  label: string;
  description?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
};

export default function StudioSwitchField({
  label,
  description,
  defaultChecked = false,
  checked,
  onChange,
  disabled = false,
}: StudioSwitchFieldProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
  const resolvedChecked = checked ?? internalChecked;

  const commitChecked = React.useCallback(
    (nextChecked: boolean) => {
      if (checked === undefined) {
        setInternalChecked(nextChecked);
      }

      onChange?.(nextChecked);
    },
    [checked, onChange],
  );

  return (
    <Stack spacing={0.5}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography
          level="body-xs"
          sx={{
            fontSize: "12.5px",
            fontWeight: 650,
            letterSpacing: "0.01em",
            color: "neutral.700",
          }}
        >
          {label}
        </Typography>
        <Switch
          size="sm"
          color="primary"
          disabled={disabled}
          checked={resolvedChecked}
          onChange={(event) => commitChecked(event.target.checked)}
          sx={{
            "--Switch-trackBackground": "var(--joy-palette-neutral-200)",
            "--Switch-trackWidth": "34px",
            "--Switch-trackHeight": "20px",
            "--Switch-thumbSize": "16px",
            "&.Joy-checked": {
              "--Switch-trackBackground": "var(--joy-palette-primary-400)",
            },
            "& .JoySwitch-thumb": {
              bgcolor: "#ffffff",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.22)",
            },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.400",
              outlineOffset: 2,
            },
          }}
        />
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        {description ? (
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            {description}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}
