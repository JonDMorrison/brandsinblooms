import { useEffect, useRef, useState } from "react";
import Alert from "@mui/joy/Alert";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { PageContainer } from "@/components/joy/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { dropBloomsuiteProviderTokens, takeBloomsuiteReturnTo } from "@/integrations/bloomsuite/session";

const RETRY_MESSAGE = "BloomSuite sign-in didn't finish. Try again in a moment.";
const CANCELLED_MESSAGE = "You didn't continue with BloomSuite, so you're not signed in.";
const REFUSED_MESSAGE =
  "BloomSuite sign-in didn't finish for this account. Sign in with your CRM email and password, or contact support.";

/**
 * /auth/bloomsuite — where the CRM's Auth server sends the browser back after "Continue with BloomSuite".
 * Completes the PKCE exchange (the client doesn't consume codes on this path by itself), takes the code out of
 * the address, and opens the kept return path or the dashboard. Provider callbacks under /auth/callback and
 * /integrations/* are separate and untouched.
 */
export default function BloomsuiteCallbackPage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const code = url.searchParams.get("code");
    const reported = url.searchParams.get("error") ?? fragment.get("error");
    // The address never keeps the code or the provider's error text.
    window.history.replaceState(window.history.state, "", url.pathname);

    if (reported || !code) {
      // access_denied: the person chose "Not now" at BloomSuite ID. Anything else the CRM's Auth server
      // refused (for example an email that belongs to another CRM account).
      setErrorMessage(reported === "access_denied" ? CANCELLED_MESSAGE : reported ? REFUSED_MESSAGE : RETRY_MESSAGE);
      return;
    }

    void supabase.auth
      .exchangeCodeForSession(code)
      .then(async ({ data, error }) => {
        if (error || !data.session) {
          setErrorMessage(RETRY_MESSAGE);
          return;
        }
        // BloomSuite ID's own tokens are dropped here and never kept in this browser (33/R-01 containment).
        if (!(await dropBloomsuiteProviderTokens(supabase, data.session))) {
          await supabase.auth.signOut({ scope: "local" });
          setErrorMessage(RETRY_MESSAGE);
          return;
        }
        navigate(takeBloomsuiteReturnTo() ?? "/dashboard", { replace: true });
      })
      .catch(() => setErrorMessage(RETRY_MESSAGE));
  }, [navigate]);

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
        <JoyCardHeader title="Signing in with BloomSuite" description="One account for every BloomSuite app." />
        <JoyCardContent sx={{ pt: 3 }}>
          {errorMessage ? (
            <Stack spacing={2}>
              <Alert color="danger" variant="soft" role="alert">
                {errorMessage}
              </Alert>
              <JoyButton onClick={() => navigate("/auth", { replace: true })}>Back to sign in</JoyButton>
            </Stack>
          ) : (
            <Stack spacing={2.5} alignItems="center" textAlign="center" role="status" aria-live="polite">
              <CircularProgress size="lg" />
              <Typography level="title-lg">Finishing your sign-in…</Typography>
            </Stack>
          )}
        </JoyCardContent>
      </JoyCard>
    </PageContainer>
  );
}
