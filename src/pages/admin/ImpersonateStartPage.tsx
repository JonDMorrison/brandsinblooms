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
import { PageContainer } from "@/components/joy/PageContainer";
import { requestImpersonationCallbackUrl } from "@/lib/admin/impersonation";

/**
 * Opens in its own tab as the signed-in admin, asks the server for a one-time
 * impersonation link and hands this tab over to the callback route, which
 * keeps the customer session in this tab only.
 */
export default function ImpersonateStartPage() {
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCloseFallback, setShowCloseFallback] = useState(false);

  const targetEmail = searchParams.get("target_email");
  const targetTenantId = searchParams.get("target_tenant_id");

  useEffect(() => {
    if (!targetEmail) {
      setErrorMessage("Invalid impersonation request. Missing the customer email.");
      return;
    }

    let isCancelled = false;

    requestImpersonationCallbackUrl({
      targetEmail,
      targetTenantId,
      origin: window.location.origin,
    })
      .then((callbackUrl) => {
        if (!isCancelled) {
          window.location.replace(callbackUrl);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Impersonation failed",
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [targetEmail, targetTenantId]);

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
          description="This tab will open as the customer. Your other tabs stay signed in as you."
        >
          <JoyChip color="primary" size="sm" variant="soft">
            Admin Impersonation
          </JoyChip>
        </JoyCardHeader>

        <JoyCardContent sx={{ pt: 3 }}>
          {errorMessage ? (
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
          ) : (
            <Stack spacing={2.5} alignItems="center" textAlign="center">
              <CircularProgress size="lg" />
              <Stack spacing={0.75}>
                <Typography level="title-lg">
                  Preparing impersonation session...
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Requesting access as {targetEmail}.
                </Typography>
              </Stack>
            </Stack>
          )}
        </JoyCardContent>
      </JoyCard>
    </PageContainer>
  );
}
