import * as React from "react";
import JoyBaseTooltip, {
  type TooltipProps as JoyBaseTooltipProps,
} from "@mui/joy/Tooltip";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

export interface JoyTooltipProps extends Omit<
  JoyBaseTooltipProps,
  "children" | "title"
> {
  children: React.ReactElement;
  title: React.ReactNode;
}

export const JoyTooltip = ({
  arrow = true,
  children,
  color = "neutral",
  enterDelay = 150,
  leaveDelay = 50,
  sx,
  title,
  variant = "solid",
  ...props
}: JoyTooltipProps) => {
  return (
    <JoyBaseTooltip
      arrow={arrow}
      color={color}
      enterDelay={enterDelay}
      leaveDelay={leaveDelay}
      title={title}
      variant={variant}
      sx={mergeSx(
        {
          zIndex: (theme) => theme.vars.zIndex.tooltip ?? theme.zIndex.tooltip,
        },
        sx,
      )}
      {...props}
    >
      {children}
    </JoyBaseTooltip>
  );
};
