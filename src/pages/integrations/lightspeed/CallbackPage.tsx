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
        
        // Store error for main page
        sessionStorage.setItem('lightspeed_oauth_error', JSON.stringify({
          error: message,
          timestamp: Date.now()
        }));
        
        setTimeout(() => {
          window.close(); // Try to close the tab
          navigate("/integrations?error=" + encodeURIComponent(message));
        }, 3000);
        return;
      }

      // Validate required parameters
      if (!code || !state || !domainPrefix) {
        console.error("[Lightspeed Callback] Missing required params");
        setStatus("error");
        setErrorMessage("Missing authorization code, state, or domain parameter");
        setTimeout(() => {
          window.close();
          navigate("/integrations?error=missing_params");
        }, 3000);
        return;
      }

      // Validate state parameter - use localStorage as primary since sessionStorage doesn't cross windows
      const storedState = localStorage.getItem('lightspeed_oauth_state_backup') || 
                          sessionStorage.getItem('lightspeed_oauth_state');
      
      console.log("[Lightspeed Callback] State validation:", {
        hasStoredState: !!storedState,
        receivedState: state?.substring(0, 12) + '...',
        storedState: storedState?.substring(0, 12) + '...'
      });
      
      if (!storedState) {
        console.error("[Lightspeed Callback] No stored state found - likely popup was blocked or state expired");
        setStatus("error");
        setErrorMessage("Session expired. Please try again. Redirecting back");
        setTimeout(() => {
          window.close();
          navigate("/integrations?error=session_expired");
        }, 3000);
        return;
      }

      if (state !== storedState) {
        console.error("[Lightspeed Callback] State mismatch:", {
          received: state.substring(0, 12) + '...',
          expected: storedState.substring(0, 12) + '...'
        });
        setStatus("error");
        setErrorMessage("Security validation failed - please try again");
        setTimeout(() => {
          window.close();
          navigate("/integrations?error=invalid_state");
        }, 3000);
        return;
      }

      console.log("[Lightspeed Callback] State validated successfully");

      try {
        // Exchange code for tokens via edge function
        console.log("[Lightspeed Callback] Exchanging code for tokens...");
        const { data, error: callbackError } = await supabase.functions.invoke(
          "lightspeed-oauth-callback",
          {
            body: { code, state, domainPrefix },
          }
        );

        if (callbackError) {
          throw new Error(callbackError.message || "Failed to complete OAuth");
        }

        if (!data || data.error) {
          throw new Error(data?.error || "Invalid response from server");
        }

        console.log("[Lightspeed Callback] Success! Connection established");
        setStatus("success");

        // Store success flag (like Facebook pattern)
        sessionStorage.setItem('lightspeed_oauth_success', JSON.stringify({
          timestamp: Date.now()
        }));

        // Clear OAuth state
        sessionStorage.removeItem('lightspeed_oauth_state');
        localStorage.removeItem('lightspeed_oauth_state_backup');

        // Close this tab and return to integrations page
        setTimeout(() => {
          window.close();
          navigate("/integrations?connected=lightspeed");
        }, 1500);

      } catch (err: any) {
        console.error("[Lightspeed Callback] Error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to connect");
        
        sessionStorage.setItem('lightspeed_oauth_error', JSON.stringify({
          error: err.message,
          timestamp: Date.now()
        }));

        setTimeout(() => {
          window.close();
          navigate("/integrations?error=" + encodeURIComponent(err.message));
        }, 3000);
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
