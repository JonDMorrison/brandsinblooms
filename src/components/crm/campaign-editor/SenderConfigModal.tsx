import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import { Mail } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyInput } from "@/components/joy/JoyInput";
import { SenderVerificationDialog } from "@/components/crm/campaign-editor/SenderVerificationDialog";

export interface SenderConfigModalProps {
  open: boolean;
  onClose: () => void;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  isLocked?: boolean;
  onSave: (next: {
    senderName: string;
    senderEmail: string;
    replyTo: string;
  }) => void;
}

export function SenderConfigModal({
  open,
  onClose,
  senderName,
  senderEmail,
  replyTo,
  isLocked = false,
  onSave,
}: SenderConfigModalProps) {
  const [draftName, setDraftName] = React.useState(senderName);
  const [draftEmail, setDraftEmail] = React.useState(senderEmail);
  const [draftReplyTo, setDraftReplyTo] = React.useState(replyTo);
  const [verificationOpen, setVerificationOpen] = React.useState(false);

  // An abandoned edit must not be reused when the modal opens again.
  React.useEffect(() => {
    if (open && !verificationOpen) {
      setDraftName(senderName);
      setDraftEmail(senderEmail);
      setDraftReplyTo(replyTo);
    }
  }, [open, replyTo, senderEmail, senderName]);

  const handleSave = React.useCallback(() => {
    onSave({
      senderName: draftName,
      senderEmail: draftEmail,
      replyTo: draftReplyTo,
    });
    onClose();
  }, [draftEmail, draftName, draftReplyTo, onClose, onSave]);

  return (
    <>
      <JoyDialog
        open={open && !verificationOpen}
        onClose={onClose}
        size="md"
        title="Sender details"
        description="Choose the name and email address your customers will see."
        startDecorator={
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "lg",
              display: "grid",
              placeItems: "center",
              backgroundColor: "neutral.100",
              color: "neutral.700",
            }}
          >
            <Mail size={21} strokeWidth={1.9} aria-hidden="true" />
          </Box>
        }
        dialogSx={{
          borderRadius: "20px",
          backgroundColor: "background.surface",
          borderColor: "neutral.200",
        }}
      >
        <JoyDialogContent sx={{ pb: 3 }}>
          <Stack spacing={2.25}>
            <JoyInput
              label="Sender name"
              value={draftName}
              disabled={isLocked}
              onValueChange={setDraftName}
              data-testid="sender-config-modal-name"
            />
            <JoyInput
              label="Sender email"
              type="email"
              value={draftEmail}
              disabled={isLocked}
              onValueChange={setDraftEmail}
              data-testid="sender-config-modal-email"
            />
            <JoyInput
              label="Reply-to email"
              type="email"
              value={draftReplyTo}
              disabled={isLocked}
              placeholder="Defaults to sender email if blank"
              helperText="Defaults to sender email if blank"
              onValueChange={setDraftReplyTo}
              data-testid="sender-config-modal-reply-to"
            />
          </Stack>
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton
            variant="plain"
            color="neutral"
            onClick={() => setVerificationOpen(true)}
            disabled={isLocked || !draftEmail.trim()}
            data-testid="sender-config-modal-verify"
          >
            Verify sender
          </JoyButton>
          <JoyButton
            variant="outlined"
            color="neutral"
            onClick={onClose}
            data-testid="sender-config-modal-cancel"
          >
            Cancel
          </JoyButton>
          <JoyButton
            variant="solid"
            color="primary"
            onClick={handleSave}
            disabled={isLocked}
            data-testid="sender-config-modal-save"
          >
            Save changes
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <SenderVerificationDialog
        open={verificationOpen}
        onClose={() => setVerificationOpen(false)}
        campaignSenderEmail={draftEmail}
        onChooseVerifiedSender={(verifiedEmail) => {
          // Keep edits in this form until the user explicitly presses Save.
          setDraftEmail(verifiedEmail);
          setDraftReplyTo((current) => current.trim() || verifiedEmail);
        }}
      />
    </>
  );
}
