import React, { useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Trash2 } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

const destructiveCardSx = {
  borderRadius: "24px",
  borderColor: "danger.200",
  boxShadow: "none",
  bgcolor: "rgba(var(--joy-palette-danger-mainChannel) / 0.04)",
  p: { xs: 2.5, md: 3 },
};

export const DeleteAccountSection = () => {
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasActiveSubscription = Boolean(
    subscription &&
      subscription.plan !== "free_trial" &&
      new Date(subscription.end_date) > new Date(),
  );

  const resetDialog = () => {
    setIsModalOpen(false);
    setConfirmText("");
    setErrorMessage(null);
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE" || !user) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    let deleted = false;

    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { userId: user.id },
      });

      if (error) {
        throw error;
      }

      deleted = true;
      await signOut();
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete this account right now.",
      );
    } finally {
      setIsLoading(false);

      if (deleted) {
        resetDialog();
      }
    }
  };

  return (
    <>
      <Sheet variant="outlined" sx={destructiveCardSx}>
        <Stack spacing={2.5}>
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <AlertTriangle size={18} color="var(--joy-palette-danger-600)" />
              <Typography level="title-lg" sx={{ color: "danger.700" }}>
                Danger Zone
              </Typography>
            </Stack>
            <Typography level="body-sm" sx={{ color: "danger.700" }}>
              Permanently delete your BloomSuite account and all associated
              data. This action cannot be undone after 30 days.
            </Typography>
          </Stack>

          <Stack spacing={0.75}>
            {[
              "All your content and campaigns will be deleted",
              "Social media connections will be revoked",
              "Analytics data will be permanently lost",
              "Active subscriptions will be cancelled",
            ].map((item) => (
              <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: "danger.500",
                    mt: 0.875,
                    flexShrink: 0,
                  }}
                />
                <Typography level="body-sm" sx={{ color: "danger.700" }}>
                  {item}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {hasActiveSubscription ? (
            <Alert color="warning" size="sm" variant="soft">
              You have an active subscription. Please cancel your subscription first before deleting your account.
            </Alert>
          ) : null}

          {errorMessage ? (
            <Alert color="danger" size="sm" variant="soft">
              {errorMessage}
            </Alert>
          ) : null}

          <JoyButton
            color="danger"
            disabled={hasActiveSubscription || isLoading}
            onClick={() => setIsModalOpen(true)}
            startDecorator={<Trash2 size={16} />}
            variant="destructive"
          >
            Delete Account
          </JoyButton>
        </Stack>
      </Sheet>

      <Modal onClose={resetDialog} open={isModalOpen}>
        <ModalDialog
          sx={{
            maxWidth: 520,
            width: "calc(100vw - 32px)",
            borderRadius: "24px",
            bgcolor: "background.surface",
          }}
          variant="outlined"
        >
          <ModalClose />
          <DialogTitle>
            <Stack direction="row" spacing={1} alignItems="center">
              <AlertTriangle size={18} color="var(--joy-palette-danger-600)" />
              <span>Delete Account Confirmation</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5}>
              <Alert color="danger" size="sm" variant="soft">
                <Stack spacing={0.75}>
                  <Typography level="body-sm" fontWeight="lg">
                    This action is irreversible after 30 days.
                  </Typography>
                  <Typography level="body-sm">
                    All account data, connected content, and analytics history will be permanently removed.
                  </Typography>
                </Stack>
              </Alert>

              {errorMessage ? (
                <Alert color="danger" size="sm" variant="soft">
                  {errorMessage}
                </Alert>
              ) : null}

              <Stack spacing={1}>
                <Typography level="body-sm">
                  To confirm deletion, type <strong>DELETE</strong> in the field below.
                </Typography>
                <Input
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder="Type DELETE to confirm"
                  sx={{ fontFamily: "var(--joy-fontFamily-code)" }}
                  value={confirmText}
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ justifyContent: "space-between", gap: 1.5 }}>
            <JoyButton color="neutral" disabled={isLoading} onClick={resetDialog} variant="outline">
              Cancel
            </JoyButton>
            <JoyButton
              color="danger"
              disabled={confirmText !== "DELETE" || isLoading}
              loading={isLoading}
              onClick={() => void handleDeleteAccount()}
              startDecorator={!isLoading ? <Trash2 size={16} /> : undefined}
              variant="destructive"
            >
              {isLoading ? "Deleting..." : "Delete Account"}
            </JoyButton>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </>
  );
};
