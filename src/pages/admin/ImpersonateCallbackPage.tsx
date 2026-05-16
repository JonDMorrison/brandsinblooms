import { useEffect, useState } from "react";
import Alert from "@mui/joy/Alert";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useSearchParams } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  IMPERSONATION_ACTIVE_STORAGE_KEY,
  IMPERSONATION_STARTED_AT_STORAGE_KEY,
  IMPERSONATION_TARGET_EMAIL_STORAGE_KEY,
} from "@/hooks/useImpersonation";
import { PageContainer } from "@/components/joy/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/utils/authErrorMessages";

export default function ImpersonateCallbackPage() {
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCloseFallback, setShowCloseFallback] = useState(false);

  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const targetEmail = searchParams.get("target_email");
  const isMissingRequiredParams = !tokenHash || !typeParam || !targetEmail;

  useEffect(() => {
    if (isMissingRequiredParams || !tokenHash) {
      setErrorMessage(
        "Invalid impersonation link. Missing required parameters.",
      );
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const establishSession = async () => {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });

      if (isCancelled) {
        return;
      }

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, "verifyOtp").message);
        setIsLoading(false);
        return;
      }

      sessionStorage.setItem(IMPERSONATION_ACTIVE_STORAGE_KEY, "true");
      sessionStorage.setItem(
        IMPERSONATION_TARGET_EMAIL_STORAGE_KEY,
        targetEmail,
      );
      sessionStorage.setItem(
        IMPERSONATION_STARTED_AT_STORAGE_KEY,
        new Date().toISOString(),
      );

      window.location.href = "/dashboard";
    };

    void establishSession().catch((error: unknown) => {
      if (isCancelled) {
        return;
      }

      setErrorMessage(getAuthErrorMessage(error, "verifyOtp").message);
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isMissingRequiredParams, targetEmail, tokenHash]);

  const handleCloseTab = () => {
    window.close();
    setShowCloseFallback(true);
  };

  return (
    <PageContainer
      fullWidth
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 2, sm: 3 },
        py: { xs: 4, sm: 6 },
        backgroundColor: "background.body",
      }}
    >
      <JoyCard sx={{ width: "100%", maxWidth: 32 }}>
        <JoyCardHeader
          title="Impersonation Session"
          description="This tab is used only to establish the impersonated account session."
        >
          <JoyChip color="primary" size="sm" variant="soft">
            Admin Impersonation
          </JoyChip>
        </JoyCardHeader>

        <JoyCardContent sx={{ pt: 3 }}>
          {isLoading ? (
            <Stack spacing={2.5} alignItems="center" textAlign="center">
              <CircularProgress size="lg" />
              <Stack spacing={0.75}>
                <Typography level="title-lg">
                  Establishing impersonation session...
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Signing in as {targetEmail}.
                </Typography>
              </Stack>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Alert color="danger" variant="soft">
                {errorMessage}
              </Alert>
              <JoyButton onClick={handleCloseTab}>Close Tab</JoyButton>
              {showCloseFallback ? (
                <Typography level="body-sm" color="neutral">
                  You can safely close this tab.
                </Typography>
              ) : null}
            </Stack>
          )}
        </JoyCardContent>
      </JoyCard>
    </PageContainer>
  );
}
