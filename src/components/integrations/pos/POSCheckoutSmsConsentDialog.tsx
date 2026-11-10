import { useEffect, useState } from "react";
import Checkbox from "@mui/joy/Checkbox";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";

interface POSCheckoutSmsConsentDialogProps {
  open: boolean;
  providerName: string;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function POSCheckoutSmsConsentDialog({
  open,
  providerName,
  isSaving,
  onClose,
  onConfirm,
}: POSCheckoutSmsConsentDialogProps) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
    }
  }, [open]);

  return (
    <JoyDialog
      open={open}
      onClose={onClose}
      title="Confirm checkout SMS disclosure"
      description={`Before connecting ${providerName}, confirm how mobile numbers are collected at checkout.`}
      size="md"
      disableClose={isSaving}
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Typography level="body-sm">
            This saves a dated policy for this POS connection. From then on,
            newly synced customers with a mobile number can receive promotional
            SMS messages. Existing customers will not be changed.
          </Typography>

          <Sheet variant="soft" color="neutral" sx={{ borderRadius: "sm", p: 1.5 }}>
            <Typography level="body-sm">
              At checkout, our business makes clear that a customer&apos;s mobile
              number may be used for promotional SMS messages, giving a number
              is optional, and they can reply STOP to opt out.
            </Typography>
          </Sheet>

          <Checkbox
            checked={confirmed}
            disabled={isSaving}
            label="I confirm our checkout process provides this disclosure before customers give us their mobile number."
            onChange={(event) => setConfirmed(event.target.checked)}
            sx={{ alignItems: "flex-start" }}
          />
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton variant="plain" color="neutral" disabled={isSaving} onClick={onClose}>
          Cancel
        </JoyButton>
        <JoyButton disabled={!confirmed || isSaving} loading={isSaving} onClick={onConfirm}>
          Save and continue
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
