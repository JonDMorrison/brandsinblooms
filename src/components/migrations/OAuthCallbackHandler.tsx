import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui-legacy/button";

export const OAuthCallbackHandler = () => {
  const [searchParams] = useSearchParams();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const provider = searchParams.get("provider");
    const status = searchParams.get("status");
    const callbackMessage = searchParams.get("message");

    // Add a small delay to ensure component has mounted
    const timer = window.setTimeout(() => {
      // New flow: when server handled token exchange and redirected back
      if (status && provider) {
        if (window.opener) {
          try {
            // IMPROVEMENT: Use actual app origin instead of '*' for postMessage security
            window.opener.postMessage(
              {
                type: status === "success" ? "oauth-success" : "oauth-error",
                provider,
                message:
                  callbackMessage ||
                  (status === "success"
                    ? "Connected successfully"
                    : "Connection failed"),
                error:
                  status === "success"
                    ? undefined
                    : callbackMessage || "Connection failed",
              },
              window.location.origin,
            );
          } catch (e) {}
        }

        // Try to close the window, show fallback if it fails
        try {
          window.close();
          // If window.close() doesn't work, show fallback after a delay
          setTimeout(() => {
            setShowFallback(true);
          }, 600);
        } catch (error) {
          setShowFallback(true);
        }
        return;
      }

      // Active providers complete their code exchange server-side, then return
      // with provider + status. Raw code/state callbacks are intentionally not
      // handled in the browser.
      setShowFallback(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [searchParams]);

  const isPopup = !!window.opener;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        {showFallback ? (
          <>
            <p className="text-foreground mb-4">Connection complete!</p>
            {isPopup ? (
              <Button onClick={() => window.close()}>Close Window</Button>
            ) : (
              <Button onClick={() => (window.location.href = "/integrations")}>
                Return to Integrations
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Completing connection...</p>
          </>
        )}
      </div>
    </div>
  );
};
