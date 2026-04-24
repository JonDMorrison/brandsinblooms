import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";

import mailchimpLogo from "@/assets/logos/mailchimp-new.png";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { supabase } from "@/integrations/supabase/client";

type ConnectMailchimpDialogPhase =
  | "idle"
  | "starting"
  | "waiting"
  | "cancelled"
  | "success"
  | "error";

export function ConnectMailchimpDialog({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => Promise<string | null>;
}) {
  const [phase, setPhase] = useState<ConnectMailchimpDialogPhase>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [successAccountName, setSuccessAccountName] = useState<string | null>(
    null,
  );
  const authorizationTabRef = useRef<Window | null>(null);
  const authorizationTabCheckIntervalRef = useRef<number | null>(null);
  const autoDismissTimeoutRef = useRef<number | null>(null);

  const clearAuthorizationTabTracking = (closeTab: boolean) => {
    if (authorizationTabCheckIntervalRef.current !== null) {
      window.clearInterval(authorizationTabCheckIntervalRef.current);
      authorizationTabCheckIntervalRef.current = null;
    }

    if (autoDismissTimeoutRef.current !== null) {
      window.clearTimeout(autoDismissTimeoutRef.current);
      autoDismissTimeoutRef.current = null;
    }

    if (closeTab && authorizationTabRef.current && !authorizationTabRef.current.closed) {
      try {
        authorizationTabRef.current.close();
      } catch {
        // Ignore tab close failures.
      }
    }

    authorizationTabRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      clearAuthorizationTabTracking(true);
      setPhase("idle");
      setFeedbackMessage(null);
      setSuccessAccountName(null);
      return;
    }

    setPhase("idle");
    setFeedbackMessage(null);
    setSuccessAccountName(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const message = event.data as
        | {
            type?: string;
            provider?: string;
            message?: string;
            error?: string;
          }
        | undefined;

      if (message?.provider !== "mailchimp") {
        return;
      }

      if (message.type === "oauth-error") {
        clearAuthorizationTabTracking(true);
        setSuccessAccountName(null);
        setFeedbackMessage(
          getUserFacingIntegrationError(
            message.error ?? message.message,
            "The connection could not be completed. Please try connecting again.",
          ),
        );
        setPhase("error");
        return;
      }

      if (message.type === "oauth-success") {
        clearAuthorizationTabTracking(true);

        void (async () => {
          let accountName: string | null = null;

          try {
            accountName = await onConnected();
          } catch {
            // Keep the success path non-blocking even if refetch stalls.
          }

          setFeedbackMessage(null);
          setSuccessAccountName(accountName);
          setPhase("success");
        })();
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onConnected, open]);

  useEffect(() => {
    if (!open || phase !== "success") {
      return;
    }

    autoDismissTimeoutRef.current = window.setTimeout(() => {
      onOpenChange(false);
    }, 2000);

    return () => {
      if (autoDismissTimeoutRef.current !== null) {
        window.clearTimeout(autoDismissTimeoutRef.current);
        autoDismissTimeoutRef.current = null;
      }
    };
  }, [onOpenChange, open, phase]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearAuthorizationTabTracking(true);
    }

    onOpenChange(nextOpen);
  };

  const startAuthorization = async () => {
    clearAuthorizationTabTracking(true);
    setFeedbackMessage(null);
    setSuccessAccountName(null);
    setPhase("starting");

    try {
      const { data, error } = await supabase.functions.invoke(
        "oauth-authorize",
        {
          body: { provider: "mailchimp" },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.message ?? data.error);
      }

      if (!data?.authUrl) {
        throw new Error("No Mailchimp authorization URL was returned.");
      }

      const authorizationTab = window.open(data.authUrl as string, "_blank");

      if (!authorizationTab || authorizationTab.closed) {
        throw new Error(
          "The Mailchimp authorization tab could not be opened. Allow new tabs and try again.",
        );
      }

      authorizationTabRef.current = authorizationTab;
      setPhase("waiting");

      authorizationTabCheckIntervalRef.current = window.setInterval(() => {
        if (authorizationTabRef.current?.closed) {
          clearAuthorizationTabTracking(false);
          setSuccessAccountName(null);
          setFeedbackMessage(
            "The Mailchimp authorization tab was closed before the connection completed.",
          );
          setPhase("cancelled");
        }
      }, 500);
    } catch (error) {
      clearAuthorizationTabTracking(true);
      setFeedbackMessage(
        getUserFacingIntegrationError(
          error,
          "The connection could not be started. Please try again.",
        ),
      );
      setPhase("error");
    }
  };

  const showPermissions =
    phase === "idle" || phase === "cancelled" || phase === "error";
  const showWaiting = phase === "starting" || phase === "waiting";
  const showSuccess = phase === "success";

  return (
    <Modal open={open} onClose={() => handleOpenChange(false)}>
      <ModalDialog
        variant="outlined"
        sx={{ maxWidth: 500, borderRadius: "lg", p: 3, bgcolor: "background.surface" }}
      >
        <ModalClose disabled={showWaiting} />

        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 0.5 }}>
          <Box
            sx={{
              flexShrink: 0,
              width: 52,
              height: 52,
              borderRadius: "xl",
              border: "1px solid",
              borderColor: "warning.200",
              bgcolor: "warning.50",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={mailchimpLogo}
              alt="Mailchimp logo"
              style={{ width: 30, height: 30, objectFit: "contain" }}
            />
          </Box>
          <Box>
            <DialogTitle sx={{ p: 0 }}>
              {showSuccess ? "Mailchimp Connected" : "Connect Mailchimp"}
            </DialogTitle>
            <Typography level="body-sm" textColor="text.tertiary" sx={{ mt: 0.5 }}>
              {showSuccess
                ? "BloomSuite can now refresh your Mailchimp audiences and connection details from this page."
                : "Authorize BloomSuite to view your Mailchimp account and cache audience metadata."}
            </Typography>
          </Box>
        </Stack>

        <DialogContent sx={{ mt: 1.5 }}>
          <Stack spacing={1.5}>
            {showPermissions ? (
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "lg", p: 2 }}
              >
                <Typography level="body-sm" fontWeight="md" mb={1}>
                  Mailchimp will grant BloomSuite permission to:
                </Typography>
                <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
                  {[
                    "Read your connected Mailchimp account details",
                    "Cache list and segment metadata for import setup",
                    "Refresh access later from this same integration page",
                  ].map((item) => (
                    <Typography key={item} component="li" level="body-sm" textColor="text.secondary">
                      {item}
                    </Typography>
                  ))}
                </Stack>
              </Sheet>
            ) : null}

            {feedbackMessage ? (
              <Alert
                color={phase === "cancelled" ? "warning" : "danger"}
                variant="soft"
                size="sm"
              >
                {feedbackMessage}
              </Alert>
            ) : null}

            {showWaiting ? (
              <Alert
                color="primary"
                variant="soft"
                size="sm"
                startDecorator={<CircularProgress size="sm" />}
              >
                <Box>
                  <Typography level="body-sm" fontWeight="md">
                    Waiting for Mailchimp authorization…
                  </Typography>
                  <Typography level="body-xs" textColor="text.tertiary" sx={{ mt: 0.5 }}>
                    Finish the authorization in the new tab to connect this account.
                  </Typography>
                </Box>
              </Alert>
            ) : null}

            {showSuccess ? (
              <Alert
                color="success"
                variant="soft"
                size="sm"
                startDecorator={<CheckCircle2 style={{ width: 16, height: 16 }} />}
              >
                <Box>
                  <Typography level="body-sm" fontWeight="md">
                    Mailchimp authorization complete
                  </Typography>
                  <Typography level="body-xs" textColor="text.tertiary" sx={{ mt: 0.5 }}>
                    {successAccountName
                      ? `Connected as ${successAccountName}.`
                      : "Your Mailchimp account is now connected."}
                  </Typography>
                </Box>
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ gap: 1, justifyContent: "flex-end" }}>
          {showSuccess ? (
            <Button
              variant="solid"
              color="neutral"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="plain"
                color="neutral"
                onClick={() => onOpenChange(false)}
                disabled={showWaiting}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                color="neutral"
                onClick={() => void startAuthorization()}
                disabled={showWaiting}
                startDecorator={
                  showWaiting ? <CircularProgress size="sm" /> : null
                }
              >
                {showWaiting
                  ? "Waiting for authorization…"
                  : phase === "cancelled"
                    ? (
                      <>
                        <RotateCcw style={{ width: 14, height: 14, marginRight: 6 }} />
                        Try Again
                      </>
                    )
                    : (
                      <>
                        Connect with Mailchimp
                        <ArrowRight style={{ width: 14, height: 14, marginLeft: 6 }} />
                      </>
                    )}
              </Button>
            </>
          )}
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}
