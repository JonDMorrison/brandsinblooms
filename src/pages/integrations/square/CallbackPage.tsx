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
    "Processing your Square connection...",
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
        console.log("[SQUARE-Callback] Processing OAuth callback");
        setStep("Processing OAuth callback...");

        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        console.log("[SQUARE-Callback] Processing:", {
          hasCode: !!code,
          hasState: !!state,
          error,
        });

        if (error) {
          clearTimeout(timeoutId);
          const errorMsg = errorDescription || error || "Authorization failed";
          const userMessage = getUserFacingIntegrationError(
            errorMsg,
            "The connection could not be completed. Please try connecting again.",
          );
          console.error("[SQUARE-Callback] OAuth error:", errorMsg);
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

        if (!code || !state) {
          clearTimeout(timeoutId);
          const errorMsg = "Missing required OAuth parameters";
          console.error("[SQUARE-Callback] Missing params");
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

        console.log("[SQUARE-Callback] Invoking callback edge function...");
        setStep("Exchanging authorization code for access tokens...");

        const redirectUri = `${window.location.origin}/integrations/square/callback`;

        const supabaseUrl = "https://udldmkqwnxhdeztyqcau.supabase.co";
        const response = await fetch(
          `${supabaseUrl}/functions/v1/square-oauth-callback`,
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

        if (fnError || data?.error || !data?.success) {
          const userMessage = getUserFacingIntegrationError(
            data?.error || fnError?.message,
            "The connection could not be completed. Please try connecting again.",
          );
          console.error(
            "[SQUARE-Callback] Edge function error:",
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

        console.log("[SQUARE-Callback] Connection successful");
        setStatus("success");
        setMessage("Connected Successfully!");
        setStep(`Connected to ${data.merchantName || "Square"}`);

        broadcastResult({
          status: "success",
          message: data?.message || "Connection successful",
          merchantName: data?.merchantName,
          showSetupWizard: true, // Trigger the setup wizard
          timestamp: Date.now(),
        });

        // Auto-close after 3 seconds
        setTimeout(() => {
          window.close();
        }, 3000);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error("[SQUARE-Callback] Unexpected error:", error);
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
    localStorage.setItem("square_oauth_result", JSON.stringify(result));

    try {
      const channel = new BroadcastChannel("square_oauth");
      channel.postMessage(result);
      channel.close();
    } catch (e) {
      console.log("[SQUARE-Callback] BroadcastChannel not supported");
    }

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: "square_oauth_result", data: result },
          window.location.origin,
        );
      } catch (e) {
        console.log("[SQUARE-Callback] Could not message opener window");
      }
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
