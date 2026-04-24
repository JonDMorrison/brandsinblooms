import * as React from "react";
import Box, { type BoxProps } from "@mui/joy/Box";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import type { SxProps } from "@mui/joy/styles/types";
import Typography from "@mui/joy/Typography";
import { X } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { mergeSx } from "@/components/joy/mergeSx";

export type JoyOverlayCloseReason =
  | "backdropClick"
  | "escapeKeyDown"
  | "closeClick";

export type JoyDialogSize = "sm" | "md" | "lg" | "xl";

export type JoyDialogContentProps = BoxProps;
export type JoyDialogActionsProps = BoxProps;

export interface JoyDialogProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Modal>,
  "children" | "open" | "onClose" | "title"
> {
  open: boolean;
  onClose: (reason?: JoyOverlayCloseReason) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: JoyDialogSize;
  children?: React.ReactNode;
  startDecorator?: React.ReactNode;
  dialogSx?: SxProps;
  hideCloseButton?: boolean;
  disableClose?: boolean;
}

const dialogWidthMap: Record<JoyDialogSize, number> = {
  sm: 400,
  md: 560,
  lg: 720,
  xl: 960,
};

export { mergeSx };

export const bloomOverlayRootSx: SxProps = {
  zIndex: (theme) => theme.vars.zIndex.modal ?? theme.zIndex.modal,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  p: 1,
};

export const bloomOverlayBackdropSx: SxProps = {
  backgroundColor: "rgba(var(--joy-palette-brandNavy-darkChannel) / 0.24)",
  backdropFilter: "blur(4px)",
  animation: "bloomDialogBackdropFadeIn 160ms ease-out",
  "@keyframes bloomDialogBackdropFadeIn": {
    from: {
      opacity: 0,
    },
    to: {
      opacity: 1,
    },
  },
};

export const bloomDialogSurfaceSx: SxProps = {
  backgroundColor: "background.surface",
  borderRadius: "var(--joy-radius-lg)",
  boxShadow: "var(--joy-shadow-xl)",
  borderColor: "neutral.200",
  width: "calc(100vw - 2rem)",
  maxHeight: "calc(100vh - 2rem)",
  m: "auto",
  p: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  inset: "auto",
  transform: "none",
  animation: "bloomDialogFadeIn 160ms ease-out",
  "@keyframes bloomDialogFadeIn": {
    from: {
      opacity: 0,
    },
    to: {
      opacity: 1,
    },
  },
};

export const JoyDialogContent = React.forwardRef<
  HTMLDivElement,
  JoyDialogContentProps
>(({ sx, ...props }, ref) => (
  <Box
    ref={ref}
    sx={mergeSx(
      {
        px: { xs: 2, sm: 3 },
        pb: { xs: 2, sm: 3 },
        minHeight: 0,
        overflowY: "auto",
      },
      sx,
    )}
    {...props}
  />
));

JoyDialogContent.displayName = "JoyDialogContent";

export const JoyDialogActions = React.forwardRef<
  HTMLDivElement,
  JoyDialogActionsProps
>(({ children, sx, ...props }, ref) => (
  <Box
    ref={ref}
    sx={mergeSx(
      {
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 3 },
        borderTop: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
      },
      sx,
    )}
    {...props}
  >
    <Stack
      direction="row"
      justifyContent="flex-end"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
    >
      {children}
    </Stack>
  </Box>
));

JoyDialogActions.displayName = "JoyDialogActions";

export const JoyDialog = ({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  startDecorator,
  dialogSx,
  hideCloseButton = false,
  disableClose = false,
  ...modalProps
}: JoyDialogProps) => {
  const titleId = React.useId();
  const descriptionId = React.useId();

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
    <Modal
      open={open}
      onClose={handleClose}
      slotProps={{
        backdrop: {
          sx: bloomOverlayBackdropSx,
        },
      }}
      sx={bloomOverlayRootSx}
      {...modalProps}
    >
      <ModalDialog
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={title ? titleId : undefined}
        layout="center"
        maxWidth={dialogWidthMap[size]}
        sx={mergeSx(bloomDialogSurfaceSx, dialogSx)}
      >
        {title || description || startDecorator || !hideCloseButton ? (
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            spacing={2}
            sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 }, pb: 2 }}
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
                {title ? (
                  <Typography id={titleId} level="title-lg">
                    {title}
                  </Typography>
                ) : null}
                {description ? (
                  <Typography
                    id={descriptionId}
                    level="body-sm"
                    color="neutral"
                  >
                    {description}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>

            {!hideCloseButton ? (
              <JoyButton
                aria-label="Close dialog"
                bloomVariant="ghost"
                disabled={disableClose}
                onClick={() => onClose("closeClick")}
                size="icon"
              >
                <X size={16} strokeWidth={1.9} />
              </JoyButton>
            ) : null}
          </Stack>
        ) : null}

        {children}
      </ModalDialog>
    </Modal>
  );
};
