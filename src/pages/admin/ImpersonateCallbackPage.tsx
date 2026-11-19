import { useEffect, useRef, useState } from "react";
import Alert from "@mui/joy/Alert";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
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
import {
  getBrowserAdminAccessToken,
  IMPERSONATION_TAB_STORAGE_KEY,
  supabase,
} from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/utils/authErrorMessages";

interface RedeemResponse {
  success?: boolean;
  token_hash?: string;
  type?: string;
  target_email?: string;
  error?: string;
}

const NOT_VALID_MESSAGE =
  "This impersonation link can only be used once, in the browser of the admin who started it. Start again from the admin page.";

/**
 * /admin/impersonate/callback — the impersonation tab (crm-r1-F04, F07). The address carries only a one-time grant
 * (in the fragment, never sent to a server). The signed-in master admin of THIS browser redeems it; only then is the
 * magic-link token minted and verified, into this tab's own session storage, next to the impersonation marker.
 */
export default function ImpersonateCallbackPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCloseFallback, setShowCloseFallback] = useState(false);
  const [targetEmail, setTargetEmail] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Runs once: the grant is single use and leaves the address on the first read.
    if (started.current) return;
    started.current = true;

    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const grantId = fragment.get("grant");
    const nonce = fragment.get("nonce");
    // The grant never stays in the address bar or the history.
    window.history.replaceState(window.history.state, "", window.location.pathname);

    if (!grantId || !nonce) {
      setErrorMessage("Invalid impersonation link. Missing required parameters.");
      setIsLoading(false);
      return;
    }

    const establishSession = async () => {
      const adminAccessToken = await getBrowserAdminAccessToken();
      if (!adminAccessToken) {
        throw new Error(NOT_VALID_MESSAGE);
      }

      const { data, error: redeemError } = await supabase.functions.invoke<RedeemResponse>(
        "admin-impersonate-user",
        {
          body: { op: "redeem", grant_id: grantId, nonce },
          headers: { Authorization: `Bearer ${adminAccessToken}` },
        },
      );
      if (redeemError || !data?.success || !data.token_hash || !data.target_email) {
        throw new Error(NOT_VALID_MESSAGE);
      }
      setTargetEmail(data.target_email);

      const { error } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, "verifyOtp").message);
        setIsLoading(false);
        return;
      }

      sessionStorage.setItem(IMPERSONATION_TAB_STORAGE_KEY, "true");
      sessionStorage.setItem(IMPERSONATION_ACTIVE_STORAGE_KEY, "true");
      sessionStorage.setItem(
        IMPERSONATION_TARGET_EMAIL_STORAGE_KEY,
        data.target_email,
      );
      sessionStorage.setItem(
        IMPERSONATION_STARTED_AT_STORAGE_KEY,
        new Date().toISOString(),
      );

      window.location.href = "/dashboard";
    };

    void establishSession().catch((error: unknown) => {
      setErrorMessage(
        error instanceof Error && error.message === NOT_VALID_MESSAGE
          ? NOT_VALID_MESSAGE
          : getAuthErrorMessage(error, "verifyOtp").message,
      );
      setIsLoading(false);
    });
  }, []);

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
                  {targetEmail ? `Signing in as ${targetEmail}.` : "Checking the impersonation grant."}
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
