import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import { Box, CircularProgress, Stack, Typography } from "@mui/joy";

const CallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<
    "loading" | "success" | "error" | "timeout"
  >("loading");
  const [message, setMessage] = useState(
    "Processing your Clover connection...",
  );
  const [step, setStep] = useState<string>("Validating OAuth response...");

  useEffect(() => {
    const handleCallback = async () => {
      const timeoutId = setTimeout(() => {
        setStatus("timeout");
        setMessage("Connection timeout - please try again");
        setStep("The request took too long to complete");

        broadcastResult({
          status: "error",
          message: "Connection timeout",
          timestamp: Date.now(),
        });
      }, 30000);

      try {
        setStep("Processing OAuth callback...");

        // Clover OAuth returns different params than Square
        const code = searchParams.get("code");
        const merchantId = searchParams.get("merchant_id");
        const employeeId = searchParams.get("employee_id");
        const error = searchParams.get("error");

        if (error) {
          clearTimeout(timeoutId);
          const errorMsg = errorDescription || error || "Authorization failed";
          const userMessage = getUserFacingIntegrationError(
            errorMsg,
            "The connection could not be completed. Please try connecting again.",
          );
          console.error("[CLOVER-Callback] OAuth error:", errorMsg);
          setStatus("error");
          setMessage("Authorization Failed");
          setStep(userMessage);

          broadcastResult({
            status: "error",
            message: userMessage,
            timestamp: Date.now(),
          });
          return;
        }

        if (!code || !merchantId) {
          clearTimeout(timeoutId);
          const errorMsg = "Missing required OAuth parameters";
          console.error("[CLOVER-Callback] Missing params");
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
          return;
        }
        setStep("Exchanging authorization code for access tokens...");

        const redirectUri = `${window.location.origin}/integrations/clover/callback`;

        const supabaseUrl = "https://udldmkqwnxhdeztyqcau.supabase.co";
        const response = await fetch(
          `${supabaseUrl}/functions/v1/clover-oauth-callback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code,
              merchant_id: merchantId,
              employee_id: employeeId,
              redirectUri,
            }),
          },
        );

        const data = await response.json();
        const fnError = response.ok
          ? null
          : { message: data.error || "Request failed" };

        clearTimeout(timeoutId);

        if (fnError || data?.error || !data?.success) {
          const userMessage = getUserFacingIntegrationError(
            data?.error || fnError?.message,
            "The connection could not be completed. Please try connecting again.",
          );
          console.error(
            "[CLOVER-Callback] Edge function error:",
            fnError || data,
          );
          setStatus("error");
          setMessage("Connection Failed");
          setStep(userMessage);

          broadcastResult({
            status: "error",
            message: userMessage,
            timestamp: Date.now(),
          });
          return;
        }
        setStatus("success");
        setMessage("Connected Successfully!");
        setStep(`Connected to ${data.merchantName || "Clover"}`);

        broadcastResult({
          status: "success",
          message: data?.message || "Connection successful",
          merchantName: data?.merchantName,
          showSetupWizard: true,
          timestamp: Date.now(),
        });

        // Auto-close after 3 seconds
        setTimeout(() => {
          window.close();
        }, 3000);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error("[CLOVER-Callback] Unexpected error:", error);
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
      }
    };

    handleCallback();
  }, [searchParams]);

  const broadcastResult = (result: any) => {
    localStorage.setItem("clover_oauth_result", JSON.stringify(result));

    try {
      const channel = new BroadcastChannel("clover_oauth");
      channel.postMessage(result);
      channel.close();
    } catch (e) {}

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: "clover_oauth_result", data: result },
          window.location.origin,
        );
      } catch (e) {}
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
              You can close this window once completed.
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
              You can close this window now.
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
              You can close this window and try connecting again.
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
          </>
        )}
      </Stack>
    </Box>
  );
};

export default CallbackPage;
