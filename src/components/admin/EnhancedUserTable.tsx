import Chip from "@mui/joy/Chip";
import Checkbox from "@mui/joy/Checkbox";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { Avatar, AvatarFallback } from "@/components/ui-legacy/avatar";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import {
  MoreHorizontal,
  Mail,
  Calendar,
  Coins,
  Trash2,
  AlertTriangle,
  Merge,
} from "lucide-react";
import { useState } from "react";
// Removed sonner import - using global toast replacement
import { isSuperAdmin } from "@/utils/adminUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useBulkUserOperations } from "@/hooks/useBulkUserOperations";
import { BulkActionsToolbar } from "./BulkActionsToolbar";

interface AdminUserData {
  id: string;
  email: string;
  created_at: string;
  company_name?: string;
  company_overview?: string;
  location_info?: string;
  plan: string;
  status: string;
  trial_end_date?: string;
  last_login?: string;
  tokens_balance?: number;
  onboarding_completed?: boolean;
  is_duplicate?: boolean;
  account_number?: number;
}

interface EnhancedUserTableProps {
  users: AdminUserData[];
  onDeleteUser: (userId: string) => Promise<boolean>;
}

export const EnhancedUserTable = ({
  users,
  onDeleteUser,
}: EnhancedUserTableProps) => {
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] =
    useState<AdminUserData | null>(null);
  const { user: currentUser } = useAuth();

  const {
    selectedUserIds,
    isProcessing,
    progress,
    toggleUserSelection,
    selectAll,
    clearSelection,
    bulkDeleteUsers,
  } = useBulkUserOperations(onDeleteUser);

  const getPlanChip = (plan: string) => {
    switch (plan) {
      case "bloom":
        return { color: "primary", label: "Bloom" };
      case "sprout":
        return { color: "success", label: "Sprout" };
      case "free_trial":
        return { color: "info", label: "Free Trial" };
      default:
        return {
          color: "neutral",
          label: plan
            .replace("_", " ")
            .replace(/\b\w/g, (char) => char.toUpperCase()),
        };
    }
  };

  const getStatusChip = (status: string) =>
    status === "active"
      ? { color: "success", label: "Active" }
      : {
          color: "danger",
          label: status.replace(/\b\w/g, (char) => char.toUpperCase()),
        };

  const getInitials = (email: string, companyName?: string) => {
    if (companyName && companyName !== "Not set") {
      return companyName
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return null;
    const days = Math.ceil(
      (new Date(endDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return days;
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    // Check if current user is super admin
    if (!currentUser?.email || !isSuperAdmin(currentUser.email)) {
      console.error(
        `[EnhancedUserTable] Access denied: Current user ${currentUser?.email} is not a super admin`,
      );
      toast.error(
        "Access denied.  Only super administrators can delete users.",
      );
      return;
    }
    if (deletingUser) {
      toast.warning("Another deletion is already in progress.  Please wait.");
      return;
    }

    setDeletingUser(userId);
    try {
      const success = await onDeleteUser(userId);
      if (success) {
        toast.success(`User ${userEmail} has been successfully deleted.`);
      } else {
        toast.error(
          `Failed to delete user ${userEmail}.  Please check the console for details.`,
        );
        console.error(
          `[EnhancedUserTable] Delete operation returned false for user: ${userEmail}`,
        );
      }
    } catch (error) {
      console.error(`[EnhancedUserTable] Error during deletion:`, error);

      // Provide specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes("Access denied")) {
          toast.error(
            "Access denied.  Only super administrators can delete users.",
          );
        } else if (error.message.includes("Network")) {
          toast.error(
            "Network error.  Please check your connection and try again.",
          );
        } else {
          toast.error(`Failed to delete user: ${error.message}`);
        }
      } else {
        toast.error("An unexpected error occurred while deleting the user.");
      }
    } finally {
      setDeletingUser(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select non-admin users
      const nonAdminUserIds = users
        .filter((user) => !isSuperAdmin(user.email))
        .map((u) => u.id);
      selectAll(nonAdminUserIds);
    } else {
      clearSelection();
    }
  };

  // Calculate selection state excluding admin users
  const selectableUsers = users.filter((user) => !isSuperAdmin(user.email));
  const selectedNonAdminCount = selectableUsers.filter((user) =>
    selectedUserIds.has(user.id),
  ).length;
  const isAllSelected =
    selectableUsers.length > 0 &&
    selectedNonAdminCount === selectableUsers.length;
  const isIndeterminate =
    selectedNonAdminCount > 0 && selectedNonAdminCount < selectableUsers.length;
  const isPendingDeleteLoading =
    pendingDeleteUser !== null && deletingUser === pendingDeleteUser.id;

  return (
    <Stack spacing={2}>
      <BulkActionsToolbar
        selectedUserIds={selectedUserIds}
        users={users}
        onBulkDelete={bulkDeleteUsers}
        onClearSelection={clearSelection}
        isProcessing={isProcessing}
        progress={progress}
      />

      <JoyCard className="enhanced-user-table">
        <JoyCardHeader
          title={`All Users (${users.length})`}
          titleProps={{ level: "title-lg" }}
        >
          <Typography level="body-sm" color="neutral">
            Showing all accounts including duplicates. Users with multiple
            accounts are marked.
            <Typography
              component="span"
              sx={{
                ml: 1,
                color: "success.700",
                fontWeight: "var(--joy-fontWeight-semibold)",
              }}
            >
              Master Admin accounts (
              {isSuperAdmin.toString().split(",").join(", ")}) are protected
              from deletion.
            </Typography>
          </Typography>
        </JoyCardHeader>
        <JoyCardContent>
          {users.length === 0 ? (
            <Stack spacing={0.75} alignItems="center" sx={{ py: 5 }}>
              <Typography level="title-sm">No users found</Typography>
              <Typography level="body-sm" color="neutral" textAlign="center">
                Refresh the admin data source or adjust the current filters.
              </Typography>
            </Stack>
          ) : (
            <JoyTable containerSx={{ minWidth: 1120 }}>
              <JoyTableHead>
                <JoyTableRow>
                  <JoyTableHeaderCell sx={{ width: 48 }}>
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onChange={(event) =>
                        handleSelectAll(event.target.checked)
                      }
                      aria-label="Select all non-admin users"
                      size="sm"
                    />
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell>User</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Company</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Plan & Status</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Trial Info</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Tokens</JoyTableHeaderCell>
                  <JoyTableHeaderCell>Last Login</JoyTableHeaderCell>
                  <JoyTableHeaderCell align="right">Actions</JoyTableHeaderCell>
                </JoyTableRow>
              </JoyTableHead>
              <JoyTableBody>
                {users.map((user, index) => {
                  // Create a unique key using user.id and index to prevent duplicate key warnings
                  const uniqueKey = `${user.id}-${index}`;
                  const daysRemaining = getDaysRemaining(user.trial_end_date);
                  const isDeleting = deletingUser === user.id;
                  const isSelected = selectedUserIds.has(user.id);
                  const isAdmin = isSuperAdmin(user.email);

                  return (
                    <JoyTableRow
                      key={uniqueKey}
                      sx={{
                        "& > td": {
                          backgroundColor: isAdmin
                            ? "success.50"
                            : isSelected || user.is_duplicate
                              ? "neutral.50"
                              : "#FFFFFF",
                          borderColor: isAdmin
                            ? "success.200"
                            : isSelected
                              ? "neutral.200"
                              : "neutral.100",
                        },
                      }}
                    >
                      <JoyTableCell>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleUserSelection(user.id)}
                          aria-label={`Select ${user.email}`}
                          disabled={isDeleting || isProcessing || isAdmin}
                          size="sm"
                        />
                      </JoyTableCell>

                      <JoyTableCell>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <Avatar style={{ width: 32, height: 32 }}>
                            <AvatarFallback
                              style={{
                                fontSize: 12,
                                backgroundColor: isAdmin
                                  ? "#DCFCE7"
                                  : undefined,
                                color: isAdmin ? "#166534" : undefined,
                              }}
                            >
                              {getInitials(user.email, user.company_name)}
                            </AvatarFallback>
                          </Avatar>
                          <Stack spacing={0.5}>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              useFlexGap
                              flexWrap="wrap"
                            >
                              <Typography
                                sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                              >
                                {user.email}
                              </Typography>
                              {isAdmin && (
                                <Chip color="success" size="sm" variant="soft">
                                  Master Admin
                                </Chip>
                              )}
                              {user.is_duplicate && !isAdmin && (
                                <Stack
                                  direction="row"
                                  spacing={0.5}
                                  alignItems="center"
                                >
                                  <AlertTriangle
                                    className="w-4 h-4"
                                    style={{
                                      color: "var(--joy-palette-neutral-500)",
                                    }}
                                  />
                                  <Chip
                                    color="neutral"
                                    size="sm"
                                    variant="soft"
                                  >
                                    Account #{user.account_number}
                                  </Chip>
                                </Stack>
                              )}
                            </Stack>
                            <Typography level="body-sm" color="neutral">
                              Joined {formatDate(user.created_at)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </JoyTableCell>

                      <JoyTableCell>
                        <Stack spacing={0.75}>
                          <Typography
                            sx={{ fontWeight: "var(--joy-fontWeight-md)" }}
                          >
                            {user.company_name || "Not set"}
                          </Typography>
                          <Chip
                            color={
                              user.onboarding_completed ? "success" : "neutral"
                            }
                            size="sm"
                            variant="soft"
                          >
                            {user.onboarding_completed
                              ? "Onboarded"
                              : "Pending"}
                          </Chip>
                        </Stack>
                      </JoyTableCell>

                      <JoyTableCell>
                        <Stack spacing={0.75}>
                          <Chip
                            color={getPlanChip(user.plan).color}
                            size="sm"
                            variant="soft"
                          >
                            {getPlanChip(user.plan).label}
                          </Chip>
                          <Chip
                            color={getStatusChip(user.status).color}
                            size="sm"
                            variant="soft"
                          >
                            {getStatusChip(user.status).label}
                          </Chip>
                        </Stack>
                      </JoyTableCell>

                      <JoyTableCell>
                        {user.plan === "free_trial" && user.trial_end_date && (
                          <Stack spacing={0.5}>
                            <Stack
                              direction="row"
                              spacing={0.5}
                              alignItems="center"
                            >
                              <Calendar
                                className="w-3 h-3"
                                style={{
                                  color: "var(--joy-palette-neutral-500)",
                                }}
                              />
                              <Typography level="body-sm">
                                Ends {formatDate(user.trial_end_date)}
                              </Typography>
                            </Stack>
                            {daysRemaining !== null && (
                              <Typography
                                level="body-xs"
                                color={
                                  daysRemaining <= 3 ? "danger" : "neutral"
                                }
                              >
                                {daysRemaining > 0
                                  ? `${daysRemaining} days left`
                                  : "Expired"}
                              </Typography>
                            )}
                          </Stack>
                        )}
                      </JoyTableCell>

                      <JoyTableCell>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <Coins
                            className="w-4 h-4"
                            style={{ color: "var(--joy-palette-warning-600)" }}
                          />
                          <Typography
                            level="body-sm"
                            color={
                              user.tokens_balance && user.tokens_balance < 0
                                ? "danger"
                                : "neutral"
                            }
                          >
                            {user.tokens_balance || 0}
                          </Typography>
                        </Stack>
                      </JoyTableCell>

                      <JoyTableCell>
                        <Typography level="body-sm" color="neutral">
                          {formatDate(user.last_login)}
                        </Typography>
                      </JoyTableCell>

                      <JoyTableCell sx={{ textAlign: "right" }}>
                        <JoyDropdownMenu>
                          <JoyDropdownMenuTrigger
                            aria-label="Open user actions"
                            disabled={isDeleting || isProcessing}
                            iconButtonSx={{ width: 32, height: 32, ml: "auto" }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </JoyDropdownMenuTrigger>
                          <JoyDropdownMenuContent placement="bottom-end">
                            <JoyDropdownMenuItem
                              startDecorator={<Mail className="h-4 w-4" />}
                            >
                              Send Email
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem>
                              View Profile
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem>
                              Reset Password
                            </JoyDropdownMenuItem>
                            {user.is_duplicate && (
                              <JoyDropdownMenuItem
                                color="primary"
                                startDecorator={<Merge className="h-4 w-4" />}
                              >
                                Manage Duplicates
                              </JoyDropdownMenuItem>
                            )}
                            {!isAdmin && (
                              <JoyDropdownMenuItem
                                destructive
                                startDecorator={<Trash2 className="h-4 w-4" />}
                                disabled={isDeleting || isProcessing}
                                onClick={() => setPendingDeleteUser(user)}
                              >
                                {isDeleting ? "Deleting..." : "Delete User"}
                              </JoyDropdownMenuItem>
                            )}
                          </JoyDropdownMenuContent>
                        </JoyDropdownMenu>
                      </JoyTableCell>
                    </JoyTableRow>
                  );
                })}
              </JoyTableBody>
            </JoyTable>
          )}
        </JoyCardContent>
      </JoyCard>

      <JoyAlertDialog
        open={pendingDeleteUser !== null}
        onClose={() => setPendingDeleteUser(null)}
        onConfirm={async () => {
          if (!pendingDeleteUser) {
            return;
          }
          await handleDeleteUser(pendingDeleteUser.id, pendingDeleteUser.email);
          setPendingDeleteUser(null);
        }}
        title="Delete User Account"
        description={
          pendingDeleteUser ? (
            <>
              Permanently delete the account for{" "}
              <strong>{pendingDeleteUser.email}</strong>
              {pendingDeleteUser.is_duplicate
                ? ` (Account #${pendingDeleteUser.account_number})`
                : ""}
              ? This deletes campaigns, content, subscriptions, and related user
              data.
            </>
          ) : undefined
        }
        variant="danger"
        confirmLabel={isPendingDeleteLoading ? "Deleting..." : "Delete User"}
        confirmDisabled={
          isPendingDeleteLoading ||
          !currentUser?.email ||
          !isSuperAdmin(currentUser.email)
        }
        cancelDisabled={isPendingDeleteLoading}
        disableClose={isPendingDeleteLoading}
        loading={isPendingDeleteLoading}
      >
        {pendingDeleteUser?.is_duplicate ? (
          <Sheet
            color="neutral"
            variant="soft"
            sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
          >
            <Typography level="body-sm">
              <strong>Note:</strong> This user has multiple accounts. Consider
              merging accounts instead of deleting.
            </Typography>
          </Sheet>
        ) : null}

        <Sheet
          color="primary"
          variant="soft"
          sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
        >
          <Typography level="body-sm">
            <strong>Admin Check:</strong> Only super administrators can delete
            users. Current user: {currentUser?.email || "Not logged in"}
            {currentUser?.email && isSuperAdmin(currentUser.email)
              ? " ✓ (Super Admin)"
              : " ✗ (Not Super Admin)"}
          </Typography>
        </Sheet>
      </JoyAlertDialog>
    </Stack>
  );
};
