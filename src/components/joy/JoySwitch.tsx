import * as React from "react";
import JoyBaseSwitch, {
  type SwitchProps as JoyBaseSwitchProps,
} from "@mui/joy/Switch";
import type { SxProps } from "@mui/joy/styles/types";

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

export interface JoySwitchProps extends Omit<JoyBaseSwitchProps, "onChange"> {
  onCheckedChange?: (checked: boolean) => void;
}

export const JoySwitch = React.forwardRef<HTMLSpanElement, JoySwitchProps>(
  ({ color = "primary", onChange, onCheckedChange, sx, ...props }, ref) => (
    <JoyBaseSwitch
      ref={ref}
      color={color}
      onChange={(event) => {
        onChange?.(event);
        onCheckedChange?.(event.target.checked);
      }}
      sx={mergeSx(
        {
          "--Switch-trackWidth": "46px",
          "--Switch-trackHeight": "26px",
          "--Switch-thumbSize": "20px",
          "--Switch-gap": "3px",
          "--Switch-trackRadius": "999px",
          "--Switch-thumbRadius": "999px",
          "--Switch-trackBackground": "var(--joy-palette-neutral-300)",
          "&:hover": {
            "--Switch-trackBackground": "var(--joy-palette-neutral-400)",
          },
          "&.Mui-checked": {
            "--Switch-trackBackground": "var(--joy-palette-primary-500)",
            "&:hover": {
              "--Switch-trackBackground": "var(--joy-palette-primary-600)",
            },
          },
          "& .MuiSwitch-thumb": {
            boxShadow: "var(--joy-shadow-sm)",
          },
        },
        sx,
      )}
      {...props}
    />
  ),
);

JoySwitch.displayName = "JoySwitch";
