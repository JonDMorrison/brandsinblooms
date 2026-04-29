import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { Box, CircularProgress, Stack, Typography } from "@mui/joy";

type OAuthResult = {
  status: "success" | "error";
  message: string;
  timestamp: number;
  retailerName?: string;
  details?: unknown;
};

const CallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<
    "loading" | "success" | "error" | "timeout"
  >("loading");
  const [message, setMessage] = useState(
    "Processing your Lightspeed connection...",
  );
  const [step, setStep] = useState<string>("Validating OAuth response...");

  useEffect(() => {
    const handleCallback = async () => {
      const timeoutId = setTimeout(() => {
        setStatus("timeout");
        setMessage("Connection timeout - please try again");
        setStep("The request took too long to complete");

        // Broadcast timeout via multiple channels
        broadcastResult({
          status: "error",
          message: "Connection timeout",
          timestamp: Date.now(),
        });

        setTimeout(() => window.close(), 3000);
      }, 30000); // 30 second timeout

      try {
        setStep("Processing OAuth callback...");

        // Extract parameters from URL
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription =
          searchParams.get("error_description") ||
          searchParams.get("errorDescription");

        // Handle OAuth errors
        if (error) {
          clearTimeout(timeoutId);
          const errorMsg = errorDescription || error || "Authorization failed";
          const userMessage = getUserFacingIntegrationError(
            errorMsg,
            "The connection could not be completed. Please try connecting again.",
          );
          console.error("[LS-Callback] OAuth error:", errorMsg);
          setStatus("error");
          setMessage("Authorization Failed");
          setStep(userMessage);

          broadcastResult({
            status: "error",
            message: userMessage,
            timestamp: Date.now(),
          });

          setTimeout(() => window.close(), 3000);
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          clearTimeout(timeoutId);
          const errorMsg = "Missing required OAuth parameters";
          console.error("[LS-Callback] Missing params:", {
            code: !!code,
            state: !!state,
          });
          setStatus("error");
          setMessage("Invalid OAuth Response");
          setStep(
            getUserFacingIntegrationError(
              errorMsg,
              "The connection response was incomplete. Please try connecting again.",
            ),
          );

          broadcastResult({
            status: "error",
            message: getUserFacingIntegrationError(
              errorMsg,
              "The connection response was incomplete. Please try connecting again.",
            ),
            timestamp: Date.now(),
          });

          setTimeout(() => window.close(), 3000);
          return;
        }
        setStep("Exchanging authorization code for access tokens...");

        // Get the current origin for redirect URI
        const redirectUri = `${window.location.origin}/integrations/lightspeed/callback`;

        // Call the edge function directly via fetch (no auth required, uses state lookup)
        const supabaseUrl = "https://udldmkqwnxhdeztyqcau.supabase.co";
        const response = await fetch(
          `${supabaseUrl}/functions/v1/lightspeed-oauth-callback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code,
              state,
              redirectUri,
            }),
          },
        );

        const data = await response.json();
        const fnError = response.ok
          ? null
          : { message: data.error || "Request failed" };

        clearTimeout(timeoutId);

        if (fnError || data?.error) {
          const userMessage = getUserFacingIntegrationError(
            data?.error || fnError?.message,
            "The connection could not be completed. Please try connecting again.",
          );
          console.error("[LS-Callback] Edge function error:", fnError || data);
          setStatus("error");
          setMessage("Connection Failed");
          setStep(userMessage);

          broadcastResult({
            status: "error",
            message: userMessage,
            details: data?.details,
            timestamp: Date.now(),
          });

          setTimeout(() => window.close(), 3000);
          return;
        }

        // Validate response
        if (!data?.success) {
          const userMessage = getUserFacingIntegrationError(
            data?.error,
            "The connection could not be completed. Please try connecting again.",
          );
          console.error("[LS-Callback] Invalid response:", data);
          setStatus("error");
          setMessage("Connection Failed");
          setStep(userMessage);

          broadcastResult({
            status: "error",
            message: userMessage,
            timestamp: Date.now(),
          });

          setTimeout(() => window.close(), 3000);
          return;
        }

        // Success!
        setStatus("success");
        setMessage("Connected Successfully!");
        setStep(`Connected to ${data.retailerName || "Lightspeed"}`);

        broadcastResult({
          status: "success",
          message: data?.message || "Connection successful",
          retailerName: data?.retailerName,
          timestamp: Date.now(),
        });

        // Close tab after showing success message
        setTimeout(() => window.close(), 2000);
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        console.error("[LS-Callback] Unexpected error:", error);
        const userMessage = getUserFacingIntegrationError(
          error,
          "The connection could not be completed. Please try connecting again.",
        );
        setStatus("error");
        setMessage("Unexpected Error");
        setStep(userMessage);

        broadcastResult({
          status: "error",
          message: userMessage,
          timestamp: Date.now(),
        });

        setTimeout(() => window.close(), 3000);
      }
    };

    handleCallback();
  }, [searchParams]);

  // Broadcast result via multiple channels for reliability
  const broadcastResult = (result: OAuthResult) => {
    // Method 1: localStorage (works cross-domain)
    localStorage.setItem("lightspeed_oauth_result", JSON.stringify(result));

    // Method 2: BroadcastChannel (more reliable, same-origin only)
    try {
      const channel = new BroadcastChannel("lightspeed_oauth");
      channel.postMessage(result);
      channel.close();
    } catch {
      // Ignore BroadcastChannel failures and continue with fallbacks.
    }

    // Method 3: Try to message opener window
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: "lightspeed_oauth_result", data: result },
          "*",
        );
      } catch {
        // Ignore opener messaging failures; localStorage remains as a fallback.
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.surface",
        p: 4,
      }}
    >
      <Stack
        spacing={2}
        alignItems="center"
        sx={{ maxWidth: 400, textAlign: "center" }}
      >
        {status === "loading" && (
          <>
            <CircularProgress size="lg" color="neutral" />
            <Typography level="title-md" fontWeight="xl">
              {message}
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {step}
            </Typography>
            <Typography level="body-xs" textColor="text.tertiary">
              This window will close automatically…
            </Typography>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle
              style={{
                width: 48,
                height: 48,
                color: "var(--joy-palette-success-500)",
              }}
            />
            <Typography
              level="title-md"
              fontWeight="xl"
              textColor="success.600"
            >
              {message}
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {step}
            </Typography>
            <Typography level="body-xs" textColor="text.tertiary">
              Closing in 2 seconds…
            </Typography>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle
              style={{
                width: 48,
                height: 48,
                color: "var(--joy-palette-danger-500)",
              }}
            />
            <Typography level="title-md" fontWeight="xl" textColor="danger.600">
              {message}
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {step}
            </Typography>
            <Typography level="body-xs" textColor="text.tertiary">
              Closing in 3 seconds… You can try connecting again.
            </Typography>
          </>
        )}
        {status === "timeout" && (
          <>
            <Clock
              style={{
                width: 48,
                height: 48,
                color: "var(--joy-palette-warning-500)",
              }}
            />
            <Typography
              level="title-md"
              fontWeight="xl"
              textColor="warning.600"
            >
              {message}
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {step}
            </Typography>
            <Typography level="body-xs" textColor="text.tertiary">
              The connection request took too long. Please try again.
            </Typography>
          </>
        )}
      </Stack>
    </Box>
  );
};

export default CallbackPage;
