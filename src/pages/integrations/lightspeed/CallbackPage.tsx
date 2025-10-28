import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const CallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      console.log("[Callback] Received params:", { code: !!code, state: !!state, error });

      if (error) {
        setStatus("error");
        setErrorMessage(`OAuth error: ${error}`);
        setTimeout(() => navigate("/integrations?error=" + encodeURIComponent(error)), 3000);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setErrorMessage("Missing authorization code or state");
        setTimeout(() => navigate("/integrations?error=missing_params"), 3000);
        return;
      }

      try {
        // Call the callback edge function to complete OAuth
        const { data, error: callbackError } = await supabase.functions.invoke(
          "lightspeed-oauth-callback",
          {
            body: { code, state },
          }
        );

        if (callbackError) {
          throw new Error(callbackError.message || "Failed to complete OAuth");
        }

        console.log("[Callback] Success:", data);
        setStatus("success");
        setTimeout(() => navigate("/integrations?connected=lightspeed"), 1500);
      } catch (err: any) {
        console.error("[Callback] Error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to connect");
        setTimeout(() => navigate("/integrations?error=" + encodeURIComponent(err.message)), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "processing" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Connecting to Lightspeed...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-green-500 text-4xl">✓</div>
            <p className="text-muted-foreground">Successfully connected! Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-destructive text-4xl">✗</div>
            <p className="text-destructive">{errorMessage}</p>
            <p className="text-muted-foreground text-sm">Redirecting back...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default CallbackPage;
