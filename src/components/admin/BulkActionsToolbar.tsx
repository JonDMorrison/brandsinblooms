import { useState } from "react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { Trash2, X } from "lucide-react";
import { SUPER_ADMIN_EMAILS } from "@/utils/adminUtils";

interface AdminUserData {
  id: string;
  email: string;
  is_duplicate?: boolean;
  account_number?: number;
}

interface BulkActionsToolbarProps {
  selectedUserIds: Set<string>;
  users: AdminUserData[];
  onBulkDelete: (users: Array<{ id: string; email: string }>) => Promise<void>;
  onClearSelection: () => void;
  isProcessing: boolean;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
}

export const BulkActionsToolbar = ({
  selectedUserIds,
  users,
  onBulkDelete,
  onClearSelection,
  isProcessing,
  progress,
}: BulkActionsToolbarProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Filter out admin users from selection
  const selectedUsers = users.filter(
    (user) =>
      selectedUserIds.has(user.id) && !SUPER_ADMIN_EMAILS.includes(user.email),
  );
  const selectedCount = selectedUsers.length;

  // Check if any admin users were selected (for warning)
  const selectedAdminUsers = users.filter(
    (user) =>
      selectedUserIds.has(user.id) && SUPER_ADMIN_EMAILS.includes(user.email),
  );

  if (selectedCount === 0 && !isProcessing && selectedAdminUsers.length === 0) {
    return null;
  }

  const handleBulkDelete = () => {
    onBulkDelete(
      selectedUsers.map((user) => ({ id: user.id, email: user.email })),
    );
  };

  const duplicateCount = selectedUsers.filter(
    (user) => user.is_duplicate,
  ).length;

  return (
    <JoyCard
      sx={{ mb: 2, backgroundColor: "primary.50", borderColor: "primary.200" }}
    >
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          alignItems={{ xs: "flex-start", lg: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Typography level="body-sm" fontWeight="md">
              {isProcessing
                ? "Processing bulk deletion..."
                : `${selectedCount} user${selectedCount !== 1 ? "s" : ""} selected`}
            </Typography>

            {selectedAdminUsers.length > 0 && !isProcessing ? (
              <Sheet
                variant="soft"
                color="warning"
                sx={{ px: 1, py: 0.5, borderRadius: "var(--joy-radius-sm)" }}
              >
                <Typography level="body-xs" sx={{ color: "warning.700" }}>
                  {selectedAdminUsers.length} admin user
                  {selectedAdminUsers.length !== 1 ? "s" : ""} excluded from
                  deletion
                </Typography>
              </Sheet>
            ) : null}

            {duplicateCount > 0 && !isProcessing ? (
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ px: 1, py: 0.5, borderRadius: "var(--joy-radius-sm)" }}
              >
                <Typography level="body-xs" color="neutral">
                  {duplicateCount} duplicate account
                  {duplicateCount !== 1 ? "s" : ""}
                </Typography>
              </Sheet>
            ) : null}

            {isProcessing ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <LinearProgress
                  determinate
                  value={(progress.completed / progress.total) * 100}
                  sx={{ width: 128, flexShrink: 0 }}
                />
                <Typography level="body-xs" color="neutral">
                  {progress.completed}/{progress.total} completed
                  {progress.failed > 0 && `, ${progress.failed} failed`}
                </Typography>
              </Stack>
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            {!isProcessing && selectedCount > 0 && (
              <>
                <JoyButton
                  bloomVariant="destructive"
                  size="sm"
                  startDecorator={<Trash2 className="w-4 h-4" />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete Selected
                </JoyButton>
                <JoyAlertDialog
                  open={deleteDialogOpen}
                  onClose={() => setDeleteDialogOpen(false)}
                  onConfirm={() => {
                    setDeleteDialogOpen(false);
                    handleBulkDelete();
                  }}
                  title={`Delete ${selectedCount} User${selectedCount !== 1 ? "s" : ""}?`}
                  description={`You are about to permanently delete ${selectedCount} user account${selectedCount !== 1 ? "s" : ""}.`}
                  variant="danger"
                  confirmLabel={`Delete ${selectedCount} User${selectedCount !== 1 ? "s" : ""}`}
                >
                  <Sheet
                    variant="outlined"
                    sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                  >
                    <Stack
                      spacing={0.75}
                      sx={{ maxHeight: 160, overflowY: "auto" }}
                    >
                      {selectedUsers.map((user) => (
                        <Stack
                          key={user.id}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                        >
                          <Typography level="body-sm">{user.email}</Typography>
                          {user.is_duplicate ? (
                            <Typography level="body-xs" color="neutral">
                              Account #{user.account_number}
                            </Typography>
                          ) : null}
                        </Stack>
                      ))}
                    </Stack>
                  </Sheet>

                  {selectedAdminUsers.length > 0 ? (
                    <Sheet
                      color="success"
                      variant="soft"
                      sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                    >
                      <Stack spacing={0.75}>
                        <Typography level="body-sm" fontWeight="lg">
                          Protected accounts will not be deleted
                        </Typography>
                        <Stack
                          component="ul"
                          spacing={0.5}
                          sx={{ pl: 2.5, m: 0 }}
                        >
                          {selectedAdminUsers.map((user) => (
                            <Typography
                              component="li"
                              key={user.id}
                              level="body-sm"
                            >
                              {user.email}
                            </Typography>
                          ))}
                        </Stack>
                      </Stack>
                    </Sheet>
                  ) : null}

                  <Sheet
                    color="danger"
                    variant="soft"
                    sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                  >
                    <Typography level="body-sm">
                      <strong>Warning:</strong> This permanently deletes
                      campaigns, content, subscriptions, and related user data.
                    </Typography>
                  </Sheet>

                  {duplicateCount > 0 ? (
                    <Sheet
                      color="neutral"
                      variant="soft"
                      sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
                    >
                      <Typography level="body-sm">
                        <strong>Note:</strong> {duplicateCount} selected user
                        {duplicateCount !== 1 ? "s have" : " has"} duplicate
                        accounts. Consider merging instead of deleting.
                      </Typography>
                    </Sheet>
                  ) : null}
                </JoyAlertDialog>

                <JoyButton
                  bloomVariant="outline"
                  size="sm"
                  onClick={onClearSelection}
                  startDecorator={<X className="w-4 h-4" />}
                >
                  Clear
                </JoyButton>
              </>
            )}

            {selectedAdminUsers.length > 0 &&
              selectedCount === 0 &&
              !isProcessing && (
                <JoyButton
                  bloomVariant="outline"
                  size="sm"
                  onClick={onClearSelection}
                  startDecorator={<X className="w-4 h-4" />}
                >
                  Clear
                </JoyButton>
              )}
          </Stack>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
};
