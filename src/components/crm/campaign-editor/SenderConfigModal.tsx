import * as React from "react";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import { JoyButton } from "@/components/joy/JoyButton";
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

  // Reset drafts whenever the modal reopens so an earlier Cancel
  // doesn't leak abandoned edits into the next open.
  React.useEffect(() => {
    if (open) {
      setDraftName(senderName);
      setDraftEmail(senderEmail);
      setDraftReplyTo(replyTo);
    }
  }, [open, replyTo, senderEmail, senderName]);

  const handleSave = React.useCallback(() => {
    onSave({
      senderName: draftName,
      senderEmail: draftEmail,
      // Leave replyTo blank if the user blanked it — the send
      // pipeline already falls back to sender_email when replyTo
      // is empty (matches the inline editor's previous behavior).
      replyTo: draftReplyTo,
    });
    onClose();
  }, [draftEmail, draftName, draftReplyTo, onClose, onSave]);

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <ModalDialog sx={{ width: "min(560px, 96vw)", maxWidth: "96vw" }}>
          <DialogTitle>Sender configuration</DialogTitle>
          <DialogContent>
            How recipients see this campaign in their inbox.
          </DialogContent>

          <Stack spacing={2} sx={{ mt: 1 }}>
            <JoyInput
              label="Sender name"
              value={draftName}
              disabled={isLocked}
              onValueChange={(value) => setDraftName(value)}
              data-testid="sender-config-modal-name"
            />
            <JoyInput
              label="Sender email"
              type="email"
              value={draftEmail}
              disabled={isLocked}
              onValueChange={(value) => setDraftEmail(value)}
              data-testid="sender-config-modal-email"
            />
            <JoyInput
              label="Reply-to email"
              type="email"
              value={draftReplyTo}
              disabled={isLocked}
              placeholder="Defaults to sender email if blank"
              helperText="Defaults to sender email if blank"
              onValueChange={(value) => setDraftReplyTo(value)}
              data-testid="sender-config-modal-reply-to"
            />
          </Stack>

          <DialogActions sx={{ mt: 1.5 }}>
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
              variant="plain"
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
              Save
            </JoyButton>
          </DialogActions>
        </ModalDialog>
      </Modal>

      <SenderVerificationDialog
        open={verificationOpen}
        onClose={() => setVerificationOpen(false)}
      />
    </>
  );
}
