import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
            <div className="text-xs text-muted-foreground mt-4">
              You can close this window once completed.
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold text-green-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
            <div className="text-xs text-muted-foreground mt-4">
              You can close this window now.
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
            <h2 className="text-xl font-semibold text-red-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
            <div className="text-xs text-muted-foreground mt-4">
              You can close this window and try connecting again.
            </div>
          </>
        )}

        {status === "timeout" && (
          <>
            <Clock className="h-12 w-12 mx-auto text-yellow-500" />
            <h2 className="text-xl font-semibold text-yellow-600">{message}</h2>
            <p className="text-sm text-muted-foreground">{step}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default CallbackPage;
