import * as React from "react";
import Box, { type BoxProps } from "@mui/joy/Box";
import type { SxProps } from "@mui/joy/styles/types";

export type PageContainerProps = BoxProps & {
  fullWidth?: boolean;
};

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

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
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 2, sm: 3, lg: 4 },
      },
      sx,
    )}
    {...props}
  />
));

PageContainer.displayName = "PageContainer";
