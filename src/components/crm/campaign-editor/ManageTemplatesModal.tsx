import * as React from "react";
import Box from "@mui/joy/Box";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import type { SavedTemplate } from "@/hooks/useSavedTemplates";

export interface ManageTemplatesModalProps {
  open: boolean;
  onClose: () => void;
  templates: SavedTemplate[];
  onRename: (
    template: SavedTemplate,
    name: string,
    description: string | null,
  ) => Promise<void> | void;
  onArchive: (template: SavedTemplate) => Promise<void> | void;
}

type EditingState =
  | { mode: "rename"; template: SavedTemplate; name: string; description: string }
  | { mode: "confirm-archive"; template: SavedTemplate }
  | null;

function describeBlockCount(template: SavedTemplate) {
  const count = template.layout_json.length;
  return `${count} block${count === 1 ? "" : "s"}`;
}

function describeDate(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  return new Date(timestamp).toLocaleDateString();
}

export function ManageTemplatesModal({
  open,
  onClose,
  templates,
  onRename,
  onArchive,
}: ManageTemplatesModalProps) {
  const [editing, setEditing] = React.useState<EditingState>(null);
  const [actionPending, setActionPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setEditing(null);
      setError(null);
      setActionPending(false);
    }
  }, [open]);

  const handleConfirmRename = async () => {
    if (editing?.mode !== "rename") return;
    const trimmed = editing.name.trim();
    if (!trimmed) {
      setError("Template name is required");
      return;
    }
    setActionPending(true);
    setError(null);
    try {
      await onRename(
        editing.template,
        trimmed,
        editing.description.trim() || null,
      );
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    } finally {
      setActionPending(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (editing?.mode !== "confirm-archive") return;
    setActionPending(true);
    setError(null);
    try {
      await onArchive(editing.template);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setActionPending(false);
    }
  };

  return (
    <Modal open={open} onClose={actionPending ? undefined : onClose}>
      <ModalDialog sx={{ width: "min(640px, 96vw)", maxWidth: "96vw" }}>
        <DialogTitle>Manage your templates</DialogTitle>
        <DialogContent>
          Rename or delete the layouts you've saved for reuse.
        </DialogContent>

        {templates.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              You haven't saved any templates yet.
            </Typography>
          </Box>
        ) : (
          <Stack
            spacing={1}
            sx={{ maxHeight: "60vh", overflowY: "auto", mt: 1 }}
            data-testid="manage-templates-list"
          >
            {templates.map((template) => (
              <Sheet
                key={template.id}
                variant="outlined"
                sx={{ borderRadius: "md", p: 1.5 }}
                data-testid={`manage-templates-row-${template.id}`}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.25}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="body-sm" fontWeight="md">
                      {template.name}
                    </Typography>
                    {template.description ? (
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.600",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {template.description}
                      </Typography>
                    ) : null}
                    <Typography
                      level="body-xs"
                      sx={{ color: "neutral.500" }}
                    >
                      {describeBlockCount(template)} · Created{" "}
                      {describeDate(template.created_at)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5}>
                    <JoyButton
                      variant="plain"
                      color="neutral"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          mode: "rename",
                          template,
                          name: template.name,
                          description: template.description ?? "",
                        })
                      }
                      disabled={actionPending}
                      data-testid={`manage-templates-rename-${template.id}`}
                    >
                      Rename
                    </JoyButton>
                    <JoyButton
                      variant="plain"
                      color="danger"
                      size="sm"
                      onClick={() =>
                        setEditing({ mode: "confirm-archive", template })
                      }
                      disabled={actionPending}
                      data-testid={`manage-templates-archive-${template.id}`}
                    >
                      Archive
                    </JoyButton>
                  </Stack>
                </Stack>
              </Sheet>
            ))}
          </Stack>
        )}

        {editing?.mode === "rename" ? (
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "md",
              p: 1.75,
              mt: 1.5,
              borderColor: "primary.200",
              backgroundColor: "primary.50",
            }}
          >
            <Stack spacing={1.5}>
              <Typography level="title-sm">Rename template</Typography>
              <JoyInput
                label="Name"
                value={editing.name}
                disabled={actionPending}
                onValueChange={(value) =>
                  setEditing({ ...editing, name: value })
                }
              />
              <JoyTextarea
                label="Description"
                minRows={2}
                value={editing.description}
                disabled={actionPending}
                onValueChange={(value) =>
                  setEditing({ ...editing, description: value })
                }
              />
              {error ? (
                <Typography level="body-sm" sx={{ color: "danger.600" }}>
                  {error}
                </Typography>
              ) : null}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <JoyButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => setEditing(null)}
                  disabled={actionPending}
                >
                  Cancel
                </JoyButton>
                <JoyButton
                  variant="solid"
                  color="primary"
                  size="sm"
                  onClick={handleConfirmRename}
                  disabled={actionPending || !editing.name.trim()}
                >
                  {actionPending ? "Saving…" : "Save"}
                </JoyButton>
              </Stack>
            </Stack>
          </Sheet>
        ) : null}

        {editing?.mode === "confirm-archive" ? (
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "md",
              p: 1.75,
              mt: 1.5,
              borderColor: "danger.200",
              backgroundColor: "danger.50",
            }}
          >
            <Stack spacing={1.5}>
              <Typography level="title-sm">Delete this template?</Typography>
              <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                {editing.template.name} will be removed permanently. This
                cannot be undone.
              </Typography>
              {error ? (
                <Typography level="body-sm" sx={{ color: "danger.600" }}>
                  {error}
                </Typography>
              ) : null}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <JoyButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => setEditing(null)}
                  disabled={actionPending}
                >
                  Cancel
                </JoyButton>
                <JoyButton
                  variant="solid"
                  color="danger"
                  size="sm"
                  onClick={handleConfirmArchive}
                  disabled={actionPending}
                  data-testid="manage-templates-confirm-archive"
                >
                  {actionPending ? "Deleting…" : "Delete"}
                </JoyButton>
              </Stack>
            </Stack>
          </Sheet>
        ) : null}

        <DialogActions sx={{ mt: 1.5 }}>
          <JoyButton
            variant="plain"
            color="neutral"
            onClick={onClose}
            disabled={actionPending}
          >
            Close
          </JoyButton>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}
