import * as React from "react";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoyTextarea } from "@/components/joy/JoyTextarea";

export const SAVE_TEMPLATE_NAME_MAX = 80;
export const SAVE_TEMPLATE_DESCRIPTION_MAX = 200;

export interface SaveAsTemplateModalSubmit {
  name: string;
  description: string;
}

export interface SaveAsTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: SaveAsTemplateModalSubmit) => Promise<void> | void;
  saving?: boolean;
}

export function SaveAsTemplateModal({
  open,
  onClose,
  onSave,
  saving = false,
}: SaveAsTemplateModalProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Reset state every time the modal opens so a previous Cancel
  // doesn't leak abandoned text into the next save attempt.
  React.useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Template name is required");
      return;
    }
    setError(null);
    try {
      await onSave({ name: trimmed, description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template");
    }
  };

  return (
    <Modal open={open} onClose={saving ? undefined : onClose}>
      <ModalDialog sx={{ width: "min(520px, 96vw)", maxWidth: "96vw" }}>
        <DialogTitle>Save this design as a template</DialogTitle>
        <DialogContent>
          You can reuse this layout for future campaigns. Only you will see
          this template.
        </DialogContent>

        <Stack spacing={2} sx={{ mt: 1 }}>
          <JoyInput
            label="Template name"
            value={name}
            placeholder="Spring newsletter layout"
            disabled={saving}
            slotProps={{ input: { maxLength: SAVE_TEMPLATE_NAME_MAX } }}
            onValueChange={(value) => setName(value)}
            data-testid="save-as-template-modal-name"
          />
          <JoyTextarea
            label="Description"
            placeholder="Optional — for your own reference"
            minRows={3}
            value={description}
            disabled={saving}
            slotProps={{
              textarea: { maxLength: SAVE_TEMPLATE_DESCRIPTION_MAX },
            }}
            onValueChange={(value) => setDescription(value)}
            data-testid="save-as-template-modal-description"
          />
          {error ? (
            <Typography
              level="body-sm"
              sx={{ color: "danger.600" }}
              data-testid="save-as-template-modal-error"
            >
              {error}
            </Typography>
          ) : null}
        </Stack>

        <DialogActions sx={{ mt: 1.5 }}>
          <JoyButton
            variant="plain"
            color="neutral"
            onClick={onClose}
            disabled={saving}
            data-testid="save-as-template-modal-cancel"
          >
            Cancel
          </JoyButton>
          <JoyButton
            variant="solid"
            color="primary"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            data-testid="save-as-template-modal-save"
          >
            {saving ? "Saving…" : "Save"}
          </JoyButton>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}
