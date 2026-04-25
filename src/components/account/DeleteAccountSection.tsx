import { useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

const dangerCardSx = {
  bgcolor: "background.surface",
  borderRadius: "md",
  p: 3,
  borderColor: "danger.outlinedBorder",
} as const;

function DangerSectionSkeleton() {
  return (
    <Sheet variant="outlined" sx={dangerCardSx}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
        <Skeleton variant="circular" width={20} height={20} />
        <Skeleton variant="text" width={120} />
      </Stack>
      <Skeleton variant="text" width={250} sx={{ mb: 1.5 }} />
      <Divider sx={{ mb: 3 }} />
      <Skeleton variant="text" width={110} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="100%" sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="88%" sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="92%" sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width="76%" sx={{ mb: 2 }} />
      <Skeleton
        variant="rectangular"
        width={132}
        height={36}
        sx={{ borderRadius: "sm" }}
      />
    </Sheet>
  );
}

export const DeleteAccountSection = () => {
  const { user, signOut } = useAuth();
  const { subscription, loading } = useSubscription();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const hasActiveSubscription = useMemo(
    () =>
      Boolean(
        subscription &&
          subscription.plan !== "free_trial" &&
          new Date(subscription.end_date) > new Date(),
      ),
    [subscription],
  );

  const closeModalAndReset = () => {
    if (isLoading) {
      return;
    }

    setIsModalOpen(false);
    setConfirmText("");
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE" || !user) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { userId: user.id },
      });

      if (error) {
        throw error;
      }

      await signOut();
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
      setIsModalOpen(false);
      setConfirmText("");
    }
  };

  if (loading) {
    return <DangerSectionSkeleton />;
  }

  return (
    <>
      <Sheet variant="outlined" sx={dangerCardSx}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
          <AlertTriangle size={20} style={{ color: "var(--joy-palette-danger-500)" }} />
          <Typography level="title-md" fontWeight={600} color="danger">
            Danger Zone
          </Typography>
        </Stack>

        <Typography level="body-sm" sx={{ color: "text.tertiary", mb: 1.5 }}>
          Irreversible and destructive actions.
        </Typography>
        <Divider sx={{ mb: 3 }} />

        <Typography level="title-sm" fontWeight={600} sx={{ mb: 1 }}>
          Delete Account
        </Typography>

        <Stack spacing={0.75} sx={{ mb: 2 }}>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            All your content and campaigns will be deleted
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Social media connections will be revoked
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Analytics data will be permanently lost
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Active subscriptions will be cancelled
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            This action cannot be undone
          </Typography>
        </Stack>

        {hasActiveSubscription ? (
          <Alert
            variant="soft"
            color="warning"
            size="sm"
            startDecorator={<AlertTriangle size={18} />}
            sx={{ mb: 2 }}
          >
            You have an active subscription. Please cancel your subscription before deleting your account.
          </Alert>
        ) : null}

        <Button
          variant="solid"
          color="danger"
          size="sm"
          startDecorator={<Trash2 size={16} />}
          disabled={hasActiveSubscription || isLoading}
          onClick={() => setIsModalOpen(true)}
        >
          Delete Account
        </Button>
      </Sheet>

      <Modal open={isModalOpen} onClose={closeModalAndReset}>
        <ModalDialog
          variant="outlined"
          layout="center"
          sx={{
            bgcolor: "background.surface",
            maxWidth: 480,
            p: 3,
            borderRadius: "md",
          }}
        >
          <ModalClose />

          <DialogTitle>
            <Stack direction="row" alignItems="center" gap={1}>
              <AlertTriangle
                size={20}
                style={{ color: "var(--joy-palette-danger-500)" }}
              />
              Delete Account Confirmation
            </Stack>
          </DialogTitle>

          <DialogContent sx={{ pt: 1 }}>
            <Typography level="body-sm" sx={{ color: "text.secondary", mb: 2 }}>
              This action is permanent and cannot be undone. All your data,
              content, connections, and settings will be permanently deleted.
            </Typography>

            <Typography level="body-sm" fontWeight={600} sx={{ mb: 1 }}>
              Type DELETE to confirm:
            </Typography>

            <FormControl>
              <Input
                placeholder="Type DELETE to confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                color={confirmText === "DELETE" ? "danger" : "neutral"}
                autoFocus
              />
            </FormControl>
          </DialogContent>

          <Divider sx={{ my: 2 }} />

          <DialogActions sx={{ pt: 0 }}>
            <Button
              variant="solid"
              color="danger"
              size="sm"
              loading={isLoading}
              disabled={confirmText !== "DELETE" || isLoading}
              onClick={() => void handleDeleteAccount()}
            >
              Permanently Delete Account
            </Button>
            <Button
              variant="plain"
              color="neutral"
              size="sm"
              onClick={closeModalAndReset}
            >
              Cancel
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </>
  );
};
