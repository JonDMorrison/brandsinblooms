import * as React from "react";
import Box from "@mui/joy/Box";
import Drawer from "@mui/joy/Drawer";
import Stack from "@mui/joy/Stack";
import type { SxProps } from "@mui/joy/styles/types";
import Typography from "@mui/joy/Typography";
import { X } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  bloomOverlayBackdropSx,
  bloomOverlayRootSx,
  mergeSx,
  type JoyOverlayCloseReason,
} from "@/components/joy/JoyDialog";

export type JoyDrawerSize = "sm" | "md" | "lg";

export interface JoyDrawerProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Drawer>,
  "anchor" | "children" | "onClose" | "open" | "size"
> {
  open: boolean;
  onClose: (reason?: JoyOverlayCloseReason) => void;
  anchor?: "left" | "right";
  size?: JoyDrawerSize;
  title?: React.ReactNode;
  description?: React.ReactNode;
  startDecorator?: React.ReactNode;
  children?: React.ReactNode;
  contentSx?: SxProps;
  disableClose?: boolean;
  hideCloseButton?: boolean;
}

const drawerWidthMap: Record<JoyDrawerSize, number> = {
  sm: 360,
  md: 480,
  lg: 640,
};

export const JoyDrawer = ({
  open,
  onClose,
  anchor = "right",
  size = "md",
  title,
  description,
  startDecorator,
  children,
  contentSx,
  disableClose = false,
  hideCloseButton = false,
  ...drawerProps
}: JoyDrawerProps) => {
  const handleClose = React.useCallback(
    (_event: {}, reason: JoyOverlayCloseReason) => {
      if (disableClose) {
        return;
      }
      onClose(reason);
    },
    [disableClose, onClose],
  );

  return (
    <Drawer
      anchor={anchor}
      onClose={handleClose}
      open={open}
      slotProps={{
        backdrop: {
          sx: bloomOverlayBackdropSx,
        },
        content: {
          sx: {
            backgroundColor: "#FFFFFF",
            boxShadow: "var(--joy-shadow-xl)",
            width: { xs: "100vw", sm: `${drawerWidthMap[size]}px` },
            maxWidth: "100vw",
            p: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
      sx={bloomOverlayRootSx}
      {...drawerProps}
    >
      {title || description || startDecorator || !hideCloseButton ? (
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={2}
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 2, sm: 3 },
            borderBottom: "1px solid",
            borderColor: "neutral.200",
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            sx={{ minWidth: 0, flex: 1 }}
          >
            {startDecorator ? (
              <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
                {startDecorator}
              </Box>
            ) : null}
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              {title ? <Typography level="title-lg">{title}</Typography> : null}
              {description ? (
                <Typography level="body-sm" color="neutral">
                  {description}
                </Typography>
              ) : null}
            </Stack>
          </Stack>

          {!hideCloseButton ? (
            <JoyButton
              aria-label="Close drawer"
              bloomVariant="ghost"
              disabled={disableClose}
              onClick={() => onClose("closeClick")}
              size="icon"
            >
              <X className="h-4 w-4" />
            </JoyButton>
          ) : null}
        </Stack>
      ) : null}

      <Box
        sx={mergeSx(
          {
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            px: { xs: 2, sm: 3 },
            py: { xs: 2, sm: 3 },
          },
          contentSx,
        )}
      >
        {children}
      </Box>
    </Drawer>
  );
};
