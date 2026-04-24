import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput as Input } from "@/components/joy/JoyInput";
import { Trash2, Users } from "lucide-react";
import { SUPER_ADMIN_EMAILS } from "@/utils/adminUtils";
// Removed sonner import - using global toast replacement
import { useState } from "react";

interface AdminUserData {
  id: string;
  email: string;
}

interface MassDeletionSectionProps {
  nonAdminUsers: AdminUserData[];
  onMassDelete: (users: AdminUserData[]) => Promise<void>;
}

export const MassDeletionSection = ({
  nonAdminUsers,
  onMassDelete,
}: MassDeletionSectionProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  const handleCloseConfirm = () => {
    setConfirmOpen(false);
    setConfirmationText("");
  };

  const handleMassDeletion = async () => {
    if (confirmationText !== "DELETE ALL") {
      toast.error('Please type "DELETE ALL" to confirm mass deletion');
      return;
    }
    let deletedCount = 0;
    let failedCount = 0;

    // Show initial progress
    toast.loading(`Deleting ${nonAdminUsers.length} users...`, {
      id: "mass-deletion",
    });

    for (const user of nonAdminUsers) {
      try {
        await onMassDelete([user]);
        deletedCount++;
      } catch (error) {
        failedCount++;
        console.error(`[MassDeletion] Error deleting ${user.email}:`, error);
      }
    }

    // Clear the toast and show results
    toast.dismiss("mass-deletion");

    if (deletedCount > 0 && failedCount === 0) {
      toast.success(
        `🎉 Successfully deleted all ${deletedCount} non-admin users! Database reset complete.`,
      );
    } else if (deletedCount > 0 && failedCount > 0) {
      toast.warning(
        `Deleted ${deletedCount} users, but ${failedCount} failed. Check console for details.`,
      );
    } else {
      toast.error(
        `Failed to delete ${failedCount} users. Check console for details.`,
      );
    }
    setConfirmationText(""); // Reset confirmation text
  };

  return (
    <JoyCard sx={{ borderColor: "danger.200", backgroundColor: "danger.50" }}>
      <JoyCardHeader
        title="Database Reset"
        description={`Delete all user accounts except Master Admin accounts (${SUPER_ADMIN_EMAILS.join(", ")})`}
        startDecorator={<Trash2 className="w-5 h-5 text-red-700" />}
      />
      <JoyCardContent>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          alignItems={{ xs: "flex-start", lg: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Users className="w-4 h-4 text-red-700" />
              <Typography level="body-sm" sx={{ color: "danger.700" }}>
                {nonAdminUsers.length} non-admin users will be deleted
              </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ color: "danger.600" }}>
              This will permanently delete all user data including profiles,
              content, campaigns, and subscriptions
            </Typography>
          </Stack>

          <JoyButton
            bloomVariant="destructive"
            disabled={nonAdminUsers.length === 0}
            startDecorator={<Trash2 className="w-4 h-4" />}
            onClick={() => setConfirmOpen(true)}
          >
            Delete All Non-Admin Users
          </JoyButton>
          <JoyAlertDialog
            open={confirmOpen}
            onClose={handleCloseConfirm}
            onConfirm={() => {
              setConfirmOpen(false);
              void handleMassDeletion();
            }}
            title="MASS DELETION WARNING"
            description={`You are about to permanently delete ${nonAdminUsers.length} user accounts.`}
            variant="danger"
            size="md"
            confirmLabel={`Delete ${nonAdminUsers.length} Users Permanently`}
            confirmDisabled={confirmationText !== "DELETE ALL"}
          >
            <Sheet
              color="danger"
              variant="soft"
              sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
            >
              <Typography level="body-sm" fontWeight="lg">
                This action is permanent and cannot be undone.
              </Typography>
            </Sheet>

            <Sheet
              color="success"
              variant="soft"
              sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
            >
              <Stack spacing={0.75}>
                <Typography level="body-sm" fontWeight="lg">
                  Protected accounts (will not be deleted)
                </Typography>
                <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, m: 0 }}>
                  {SUPER_ADMIN_EMAILS.map((email) => (
                    <Typography component="li" key={email} level="body-sm">
                      {email}
                    </Typography>
                  ))}
                </Stack>
              </Stack>
            </Sheet>

            <Sheet
              color="neutral"
              variant="soft"
              sx={{ p: 1.5, borderRadius: "var(--joy-radius-md)" }}
            >
              <Stack spacing={0.75}>
                <Typography level="body-sm" fontWeight="lg">
                  This will delete all:
                </Typography>
                <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, m: 0 }}>
                  <Typography component="li" level="body-sm">
                    User profiles and company data
                  </Typography>
                  <Typography component="li" level="body-sm">
                    Content tasks and campaigns
                  </Typography>
                  <Typography component="li" level="body-sm">
                    Subscriptions and billing data
                  </Typography>
                  <Typography component="li" level="body-sm">
                    Social connections and analytics
                  </Typography>
                </Stack>
              </Stack>
            </Sheet>

            <Input
              label='Type "DELETE ALL" to confirm:'
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE ALL"
            />
          </JoyAlertDialog>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
};
