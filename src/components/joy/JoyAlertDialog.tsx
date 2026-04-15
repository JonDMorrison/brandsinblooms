import * as React from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
  type JoyDialogSize,
  type JoyOverlayCloseReason,
} from "@/components/joy/JoyDialog";

export interface JoyAlertDialogProps {
  open: boolean;
  onClose: (reason?: JoyOverlayCloseReason) => void;
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "warning" | "danger";
  loading?: boolean;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  disableClose?: boolean;
  size?: JoyDialogSize;
}

const variantConfig = {
  warning: {
    color: "warning" as const,
    icon: AlertTriangle,
    iconLabel: "Warning",
  },
  danger: {
    color: "danger" as const,
    icon: ShieldAlert,
    iconLabel: "Danger",
  },
};

export const JoyAlertDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  children,
  confirmDisabled = false,
  cancelDisabled = false,
  disableClose = false,
  size = "sm",
}: JoyAlertDialogProps) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleDialogClose = React.useCallback(
    (reason?: JoyOverlayCloseReason) => {
      if (disableClose) {
        return;
      }
      if (reason === "backdropClick") {
        return;
      }
      onClose(reason);
    },
    [disableClose, onClose],
  );

  return (
    <JoyDialog
      disableClose={disableClose}
      hideCloseButton
      onClose={handleDialogClose}
      open={open}
      size={size}
      startDecorator={
        <Sheet
          color={config.color}
          variant="soft"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--joy-radius-md)",
          }}
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only">{config.iconLabel}</span>
        </Sheet>
      }
      title={title}
      description={description}
    >
      {children ? (
        <JoyDialogContent>
          <Stack spacing={2}>{children}</Stack>
        </JoyDialogContent>
      ) : null}
      <JoyDialogActions>
        <JoyButton
          bloomVariant="ghost"
          color="neutral"
          disabled={cancelDisabled || loading}
          onClick={() => onClose("closeClick")}
          variant="plain"
        >
          {cancelLabel}
        </JoyButton>
        <JoyButton
          color={config.color}
          disabled={confirmDisabled}
          loading={loading}
          loadingPosition="start"
          onClick={() => {
            void onConfirm();
          }}
          variant="solid"
        >
          {confirmLabel}
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
};
