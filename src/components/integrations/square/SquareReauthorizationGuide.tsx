import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Heart,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";

import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ReauthStep = "intro" | "explain" | "authorizing" | "success" | "error";

interface SquareReauthorizationGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId?: string;
  onSuccess?: () => void;
}

const STEPS = [
  { id: "intro", label: "Why Update?" },
  { id: "explain", label: "What Happens" },
  { id: "authorizing", label: "Authorize" },
  { id: "success", label: "Done" },
];

const NEW_PERMISSIONS = [
  {
    name: "Loyalty Program Access",
    description: "Sync loyalty members and point balances",
  },
];

export const SquareReauthorizationGuide = ({
  open,
  onOpenChange,
  connectionId,
  onSuccess,
}: SquareReauthorizationGuideProps) => {
  const [currentStep, setCurrentStep] = useState<ReauthStep>("intro");
  const [authProgress, setAuthProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setCurrentStep("intro");
      setAuthProgress(0);
      setErrorMessage(null);
    }
  }, [open]);

  useEffect(() => {
    if (currentStep !== "authorizing") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleOAuthResult = (data: any) => {
      if (Date.now() - data.timestamp < 30000) {
        localStorage.removeItem("square_oauth_result");
        if (data.status === "success") {
          setAuthProgress(100);
          setTimeout(() => setCurrentStep("success"), 500);
        } else if (data.status === "error") {
          setErrorMessage(
            getUserFacingIntegrationError(
              data.message,
              "The connection could not be completed. Please try again.",
            ),
          );
          setCurrentStep("error");
        }
      }
    };

    const checkLocalStorage = () => {
      const result = localStorage.getItem("square_oauth_result");
      if (result) {
        try {
          handleOAuthResult(JSON.parse(result));
        } catch (e) {
          console.error("[REAUTH] Error parsing OAuth result:", e);
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("square_oauth");
      channel.onmessage = (event) => handleOAuthResult(event.data);
    } catch { /* ignore */ }

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "square_oauth_result"
      ) {
        handleOAuthResult(event.data.data);
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", checkLocalStorage);
    const interval = setInterval(checkLocalStorage, 500);

    return () => {
      window.removeEventListener("storage", checkLocalStorage);
      window.removeEventListener("message", handleMessage);
      channel?.close();
      clearInterval(interval);
    };
  }, [currentStep]);

  const startReauthorization = async () => {
    setCurrentStep("authorizing");
    setAuthProgress(20);

    try {
      if (connectionId) {
        setAuthProgress(30);
        await supabase.from("square_connections").delete().eq("id", connectionId);
      }

      setAuthProgress(50);

      const state = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke("square-oauth-start", {
        body: { state },
      });

      if (error || !data?.authUrl) {
        throw new Error(error?.message || "Failed to initiate authorization");
      }

      setAuthProgress(70);
      localStorage.removeItem("square_oauth_result");

      const link = document.createElement("a");
      link.href = data.authUrl as string;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: unknown) {
      console.error("[REAUTH] Error:", error);
      setErrorMessage(
        getUserFacingIntegrationError(error, "Failed to start authorization. Please try again."),
      );
      setCurrentStep("error");
    }
  };

  const handleSuccess = () => {
    onSuccess?.();
    onOpenChange(false);
    toast({ title: "✓ Permissions updated successfully", description: "Your Square connection now has access to Loyalty Program data." });
  };

  const triggerLoyaltyBackfill = async () => {
    try {
      toast({ title: "Starting loyalty sync...", description: "This may take a moment." });
      const { error } = await supabase.functions.invoke("square-loyalty-backfill");
      if (error) throw error;
      toast({ title: "✓ Loyalty sync complete", description: "Your loyalty members have been synced." });
    } catch (error: unknown) {
      toast({
        title: "Loyalty sync failed",
        description: getUserFacingIntegrationError(error, "Square loyalty sync could not be completed."),
        variant: "destructive",
      });
    }
    handleSuccess();
  };

  const getStepIndex = () => {
    const idx = STEPS.findIndex((s) => s.id === currentStep);
    return idx === -1 ? 0 : idx;
  };

  const progressValue = ((getStepIndex() + 1) / STEPS.length) * 100;

  return (
    <Modal open={open} onClose={() => currentStep !== "authorizing" && onOpenChange(false)}>
      <ModalDialog
        variant="outlined"
        sx={{ maxWidth: 480, borderRadius: "lg", p: 3, bgcolor: "background.surface" }}
      >
        {currentStep !== "authorizing" && <ModalClose />}

        <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
          <Shield style={{ width: 18, height: 18 }} />
          <DialogTitle sx={{ p: 0 }}>Update Square Permissions</DialogTitle>
        </Stack>

        {/* Step progress */}
        <Box mb={2}>
          <LinearProgress determinate value={progressValue} size="sm" color="neutral" sx={{ mb: 0.75 }} />
          <Stack direction="row" justifyContent="space-between">
            {STEPS.map((step, idx) => (
              <Typography
                key={step.id}
                level="body-xs"
                fontWeight={idx <= getStepIndex() ? "md" : "normal"}
                textColor={idx <= getStepIndex() ? "text.primary" : "text.tertiary"}
              >
                {step.label}
              </Typography>
            ))}
          </Stack>
        </Box>

        <DialogContent sx={{ minHeight: 280, mt: 0 }}>
          {currentStep === "intro" && (
            <Stack spacing={2.5}>
              <Stack alignItems="center" spacing={1}>
                <Box sx={{ width: 56, height: 56, borderRadius: "xl", bgcolor: "neutral.softBg", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles style={{ width: 28, height: 28 }} />
                </Box>
                <Typography level="title-md" fontWeight="xl" textAlign="center">
                  New Capabilities Available!
                </Typography>
                <Typography level="body-sm" textColor="text.tertiary" textAlign="center">
                  We've added new features to your Square integration. Update your permissions to unlock them.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                {NEW_PERMISSIONS.map((perm, idx) => (
                  <Sheet key={idx} variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 1.5 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <CheckCircle2 style={{ width: 16, height: 16, color: "var(--joy-palette-success-500)", flexShrink: 0, marginTop: 2 }} />
                      <Box>
                        <Typography level="body-sm" fontWeight="md">{perm.name}</Typography>
                        <Typography level="body-xs" textColor="text.tertiary">{perm.description}</Typography>
                      </Box>
                    </Stack>
                  </Sheet>
                ))}
              </Stack>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="plain" color="neutral" onClick={() => onOpenChange(false)}>
                  Maybe Later
                </Button>
                <Button variant="solid" color="neutral" onClick={() => setCurrentStep("explain")} endDecorator={<ArrowRight style={{ width: 14, height: 14 }} />}>
                  Continue
                </Button>
              </Stack>
            </Stack>
          )}

          {currentStep === "explain" && (
            <Stack spacing={2.5}>
              <Stack alignItems="center" spacing={1}>
                <Box sx={{ width: 56, height: 56, borderRadius: "xl", bgcolor: "primary.softBg", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RefreshCw style={{ width: 28, height: 28, color: "var(--joy-palette-primary-500)" }} />
                </Box>
                <Typography level="title-md" fontWeight="xl" textAlign="center">Here's What Will Happen</Typography>
              </Stack>

              <Stack spacing={1}>
                {[
                  "A Square authorization window will open",
                  "You'll see the updated permissions list",
                  "Click "Allow" to grant access",
                  "The window will close automatically",
                ].map((step, idx) => (
                  <Stack key={idx} direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", bgcolor: "neutral.softBg", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>
                      {idx + 1}
                    </Box>
                    <Typography level="body-sm" sx={{ pt: 0.25 }}>{step}</Typography>
                  </Stack>
                ))}
              </Stack>

              <Alert color="success" variant="soft" size="sm" startDecorator={<Lock style={{ width: 14, height: 14 }} />}>
                Your existing data is safe — customers, sales, and products will not be affected.
              </Alert>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="plain" color="neutral" onClick={() => setCurrentStep("intro")}>Back</Button>
                <Button variant="solid" color="neutral" onClick={() => void startReauthorization()} endDecorator={<ArrowRight style={{ width: 14, height: 14 }} />}>
                  Update Permissions
                </Button>
              </Stack>
            </Stack>
          )}

          {currentStep === "authorizing" && (
            <Stack spacing={2.5} alignItems="center" sx={{ py: 2 }}>
              <CircularProgress size="lg" color="neutral" />
              <Box textAlign="center">
                <Typography level="title-md" fontWeight="xl" mb={0.5}>Authorizing...</Typography>
                <Typography level="body-sm" textColor="text.tertiary">
                  Complete the authorization in the Square window that opened.
                </Typography>
              </Box>

              <LinearProgress determinate value={authProgress} size="sm" color="neutral" sx={{ width: "100%", maxWidth: 280 }} />

              <Stack spacing={0.75}>
                {[
                  { threshold: 30, label: "Preparing connection" },
                  { threshold: 70, label: "Opening Square" },
                  { threshold: 100, label: "Waiting for authorization" },
                ].map(({ threshold, label }) => (
                  <Stack key={label} direction="row" spacing={1} alignItems="center">
                    {authProgress >= threshold ? (
                      <CheckCircle2 style={{ width: 14, height: 14, color: "var(--joy-palette-success-500)" }} />
                    ) : authProgress >= threshold - 40 ? (
                      <CircularProgress size="sm" />
                    ) : (
                      <Box sx={{ width: 14, height: 14 }} />
                    )}
                    <Typography
                      level="body-sm"
                      textColor={authProgress >= threshold ? "success.600" : "text.tertiary"}
                    >
                      {label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Button variant="plain" color="neutral" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </Stack>
          )}

          {currentStep === "success" && (
            <Stack spacing={2.5} alignItems="center" sx={{ py: 2 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: "xl", bgcolor: "success.softBg", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 style={{ width: 28, height: 28, color: "var(--joy-palette-success-500)" }} />
              </Box>
              <Box textAlign="center">
                <Typography level="title-md" fontWeight="xl" mb={0.5}>Permissions Updated!</Typography>
                <Typography level="body-sm" textColor="text.tertiary">
                  Your Square connection now has access to new features.
                </Typography>
              </Box>

              <Stack spacing={0.75} sx={{ width: "100%" }}>
                {NEW_PERMISSIONS.map((perm, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <CheckCircle2 style={{ width: 14, height: 14, color: "var(--joy-palette-success-500)" }} />
                    <Typography level="body-sm">{perm.name}</Typography>
                  </Stack>
                ))}
              </Stack>

              <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                <Button variant="outlined" color="neutral" onClick={handleSuccess} sx={{ flex: 1 }}>
                  Close
                </Button>
                <Button
                  variant="solid"
                  color="neutral"
                  onClick={() => void triggerLoyaltyBackfill()}
                  startDecorator={<Heart style={{ width: 14, height: 14 }} />}
                  sx={{ flex: 1 }}
                >
                  Sync Loyalty Now
                </Button>
              </Stack>
            </Stack>
          )}

          {currentStep === "error" && (
            <Stack spacing={2.5} alignItems="center" sx={{ py: 2 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: "xl", bgcolor: "danger.softBg", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <XCircle style={{ width: 28, height: 28, color: "var(--joy-palette-danger-500)" }} />
              </Box>
              <Box textAlign="center">
                <Typography level="title-md" fontWeight="xl" mb={0.5}>Authorization Failed</Typography>
                <Typography level="body-sm" textColor="text.tertiary">
                  {errorMessage || "Something went wrong. Please try again."}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                <Button variant="plain" color="neutral" onClick={() => onOpenChange(false)} sx={{ flex: 1 }}>
                  Cancel
                </Button>
                <Button variant="solid" color="neutral" onClick={() => setCurrentStep("explain")} sx={{ flex: 1 }}>
                  Try Again
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
};
