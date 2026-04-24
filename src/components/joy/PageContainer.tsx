import * as React from "react";
import Box, { type BoxProps } from "@mui/joy/Box";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

export type PageContainerProps = BoxProps & {
  fullWidth?: boolean;
};

export const PageContainer = React.forwardRef<
  HTMLDivElement,
  PageContainerProps
>(({ fullWidth = false, sx, ...props }, ref) => (
  <Box
    ref={ref}
    sx={mergeSx(
      {
        width: "100%",
        maxWidth: fullWidth ? "100%" : "80rem",
        mx: "auto",
        px: 0,
        py: 0,
      },
      sx,
    )}
    {...props}
  />
));

PageContainer.displayName = "PageContainer";
