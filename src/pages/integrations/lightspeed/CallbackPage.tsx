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
      const domainPrefix = searchParams.get("domain_prefix");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      console.log("[Lightspeed Callback] Received params:", { 
        code: !!code, 
        state: state?.substring(0, 12) + '...', 
        domainPrefix,
        error,
        errorDescription
      });

      // Handle OAuth errors from Lightspeed
      if (error) {
        console.error("[Lightspeed Callback] OAuth error:", error, errorDescription);
        setStatus("error");
        const message = errorDescription || error || "Authorization failed";
        setErrorMessage(message);
        
        // Store result in localStorage for parent window
        localStorage.setItem('lightspeed_oauth_result', JSON.stringify({
          status: 'error',
          message,
          timestamp: Date.now()
        }));
        
        // Close tab after showing error briefly
        setTimeout(() => {
          window.close();
        }, 1500);
        return;
      }

      // Validate required parameters
      if (!code || !state || !domainPrefix) {
        console.error("[Lightspeed Callback] Missing required parameters:", { code: !!code, state: !!state, domainPrefix });
        setStatus("error");
        setErrorMessage("Missing authorization parameters");
        
        // Store result in localStorage for parent window
        localStorage.setItem('lightspeed_oauth_result', JSON.stringify({
          status: 'error',
          message: 'Missing authorization parameters',
          timestamp: Date.now()
        }));
        
        // Close tab after showing error briefly
        setTimeout(() => {
          window.close();
        }, 1500);
        return;
      }

      console.log("[Lightspeed Callback] All params validated, proceeding with token exchange");

      try {
        // Exchange code for tokens via edge function
        const redirectUri = `${window.location.origin}/integrations/lightspeed/callback`;
        console.log("[Lightspeed Callback] Calling edge function with:", { 
          hasCode: !!code, 
          hasState: !!state, 
          domainPrefix,
          redirectUri 
        });
        
        const { data, error: callbackError } = await supabase.functions.invoke(
          "lightspeed-oauth-callback",
          {
            body: { code, state, domainPrefix, redirectUri },
          }
        );

        if (callbackError) {
          throw new Error(callbackError.message || "Failed to complete OAuth");
        }

        if (!data || data.error) {
          const message = (data && (data.details || data.error)) || "Invalid response from server";
          throw new Error(message);
        }

        console.log("[Lightspeed Callback] Success! Connection established");
        setStatus("success");

        // Store success result in localStorage for parent window
        localStorage.setItem('lightspeed_oauth_result', JSON.stringify({
          status: 'success',
          timestamp: Date.now()
        }));

        // Close tab after showing success briefly
        setTimeout(() => {
          window.close();
        }, 1500);

      } catch (err: any) {
        console.error("[Lightspeed Callback] Error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to connect");

        // Store error result in localStorage for parent window
        localStorage.setItem('lightspeed_oauth_result', JSON.stringify({
          status: 'error',
          message: err.message || 'Failed to connect',
          timestamp: Date.now()
        }));

        // Close tab after showing error briefly
        setTimeout(() => {
          window.close();
        }, 1500);
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
            <p className="text-muted-foreground">Successfully connected! Closing...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-destructive text-4xl">✗</div>
            <p className="text-destructive">{errorMessage}</p>
            <p className="text-muted-foreground text-sm">Closing...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default CallbackPage;
