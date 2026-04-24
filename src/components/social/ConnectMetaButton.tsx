import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui-legacy/button";
import { Facebook, Instagram, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOAuthConfig } from "@/lib/api/oauth";
import { OAuthLoadingOverlay } from "./OAuthLoadingOverlay";
import { AgeAndTermsVerification } from "./AgeAndTermsVerification";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getOAuthRedirectUri } from "@/utils/environmentUtils";

interface ConnectMetaButtonProps {
  onSuccess: () => void;
}

export const ConnectMetaButton: React.FC<ConnectMetaButtonProps> = ({
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<"preparing" | "redirecting">(
    "preparing",
  );
  const [unavailable, setUnavailable] = useState(false);
  const [isAgeAndTermsVerified, setIsAgeAndTermsVerified] = useState(false);
  const [isMetaConnected, setIsMetaConnected] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const { user } = useAuth();

  // Check Meta connection status
  const fetchMetaConnectionStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("social_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .in("platform", ["facebook", "instagram"]);

      if (error) throw error;

      setIsMetaConnected((data && data.length > 0) || false);
    } catch (error) {
      console.error("Error fetching Meta connection status:", error);
      setIsMetaConnected(false);
    }
  };

  // Listen for postMessage from the OAuth popup/tab
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { type, provider } = event.data || {};
      if (provider !== "meta") return;

      if (type === "oauth-success") {
        setLoading(false);
        setIsMetaConnected(true);
        toast.success("Meta account connected successfully!");
        onSuccess();
        fetchMetaConnectionStatus();
      } else if (type === "oauth-error") {
        setLoading(false);
        const msg = event.data?.error || "Connection failed";
        setOauthError(msg);
        setCanRetry(true);
        toast.error(msg);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSuccess]);

  // Check for success callback and fetch connection status
  useEffect(() => {
    const successData = sessionStorage.getItem("social_connection_success");
    if (successData) {
      try {
        const data = JSON.parse(successData);
        if (Date.now() - data.timestamp < 30000) {
          onSuccess();
        }
        sessionStorage.removeItem("social_connection_success");
      } catch (error) {
        console.error("Error processing success data:", error);
      }
    }

    // Fetch initial connection status
    fetchMetaConnectionStatus();
  }, [onSuccess, user]);

  // Clean up stale OAuth attempts
  const cleanupStaleOAuth = async () => {
    setLoading(true);
    setLoadingStep("preparing");

    try {
      const { data, error } = await supabase.functions.invoke(
        "oauth-cleanup-stale",
      );

      if (error) throw error;

      // Clear all OAuth-related browser storage
      sessionStorage.removeItem("oauth_state");
      localStorage.removeItem("oauth_state_backup");
      localStorage.removeItem("oauth_state_primary");
      sessionStorage.removeItem("processed_oauth_codes");
      toast.success(
        "We've reset your previous Meta authorization attempts. Please click Connect Meta again to start a fresh connection.",
      );

      setOauthError(null);
      setCanRetry(false);

      // Refresh connection status
      await fetchMetaConnectionStatus();
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
      toast.error(
        "Could not reset OAuth state. Please try again or contact support.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user) {
      toast.error("Please log in to connect your account");
      return;
    }

    // Check age and terms verification
    if (!isAgeAndTermsVerified) {
      toast.error("Please verify your age and accept terms to continue");
      return;
    }
    setOauthError(null);
    setCanRetry(false);

    // Proceed with OAuth flow (allows reconnection for expired tokens)
    await initiateOAuthFlow();
  };

  const initiateOAuthFlow = async () => {
    setLoading(true);
    setLoadingStep("preparing");

    try {
      // ═══════════════════════════════════════════════════════════
      // 🔍 ENVIRONMENT & REDIRECT URI DETECTION
      // ═══════════════════════════════════════════════════════════
      const currentOrigin = window.location.origin;
      const currentHostname = window.location.hostname;
      const isDev =
        currentHostname.includes("localhost") ||
        currentHostname.includes("lovableproject.com") ||
        currentHostname.includes("lovable.app");

      console.log("🌍 Environment Detection:", {
        origin: currentOrigin,
        hostname: currentHostname,
        isDevelopment: isDev,
        fullUrl: window.location.href,
        timestamp: new Date().toISOString(),
      });
      // Clear any previous OAuth state
      sessionStorage.removeItem("oauth_state");
      localStorage.removeItem("oauth_state_backup");
      localStorage.removeItem("oauth_state_primary");
      sessionStorage.removeItem("processed_oauth_codes");

      // Generate secure state parameter
      const state = crypto.randomUUID();
      const timestamp = Date.now().toString();
      const combinedState = `${state}-${timestamp}`;

      // Store state with triple redundancy for reliability
      sessionStorage.setItem("oauth_state", combinedState);
      localStorage.setItem("oauth_state_backup", combinedState);
      localStorage.setItem("oauth_state_primary", combinedState);

      // Verify localStorage write succeeded
      const verifyState = localStorage.getItem("oauth_state_backup");
      if (verifyState !== combinedState) {
        console.error("❌ Failed to store OAuth state in localStorage");
        toast.error(
          "Browser storage issue. Please try again or use a different browser.",
        );
        setLoading(false);
        return;
      }
      // Define scopes
      const scopes = [
        "pages_read_engagement",
        "pages_show_list",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_insights",
      ].join(",");

      // Dynamic redirect URI based on current domain
      const redirectUri = getOAuthRedirectUri();

      // Fetch OAuth config
      const configData = await fetchOAuthConfig();
      const clientId = configData.clientId;

      // Build Facebook OAuth URL with enhanced parameters for App Review
      const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("response_type", "code");

      // Show redirecting step
      setLoadingStep("redirecting");

      const oauthUrlStr = authUrl.toString();

      // Open in a popup/new tab — NOT same-window redirect.
      // Same-window redirect causes Supabase's detectSessionInUrl to
      // misinterpret the Facebook ?code= as a PKCE code, destroying the
      // user's session. A popup keeps the parent tab's session intact.
      const oauthPopup = window.open(oauthUrlStr, "_blank");

      if (!oauthPopup) {
        toast.error(
          "Pop-up blocked — please allow pop-ups for this site and try again.",
        );
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error("❌ OAuth initiation error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initiate OAuth";

      // Check if error indicates a retry is possible
      if (
        errorMessage.includes("already been used") ||
        errorMessage.includes("already processed")
      ) {
        setOauthError(errorMessage);
        setCanRetry(true);
        toast.error(`${errorMessage}. Click "Reset & Retry" below.`, {
          duration: 6000,
        });
      } else {
        toast.error(`Connection failed: ${errorMessage}`);
        setUnavailable(true);
      }

      setLoading(false);

      // Refresh connection status after OAuth attempt
      setTimeout(() => {
        fetchMetaConnectionStatus();
      }, 1000);
    }
  };

  if (unavailable) {
    return (
      <div className="w-full p-4 rounded-lg bg-background/50 border border-border/50">
        <p className="text-sm text-muted-foreground text-center">
          Social posting temporarily unavailable. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <>
      <OAuthLoadingOverlay isVisible={loading} step={loadingStep} />
      <div className="space-y-4">
        <AgeAndTermsVerification
          isChecked={isAgeAndTermsVerified}
          onCheckedChange={setIsAgeAndTermsVerified}
        />

        {/* Development Diagnostics Panel */}
        {(() => {
          const isDevelopment =
            window.location.hostname.includes("localhost") ||
            window.location.hostname.includes("lovableproject.com") ||
            window.location.hostname.includes("lovable.app");
          const diagnosticsInfo = {
            origin: window.location.origin,
            expectedRedirect: `${window.location.origin}/oauth/callback`,
            environment: isDevelopment ? "development" : "production",
            hostname: window.location.hostname,
          };

          return isDevelopment ? (
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-foreground mb-2">
                🔧 OAuth Diagnostics (Dev Mode)
              </p>
              <p className="text-muted-foreground">
                <strong>Origin:</strong> {diagnosticsInfo.origin}
              </p>
              <p className="text-muted-foreground">
                <strong>Expected Redirect URI:</strong>{" "}
                {diagnosticsInfo.expectedRedirect}
              </p>
              <p className="text-muted-foreground">
                <strong>Environment:</strong> {diagnosticsInfo.environment}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(diagnosticsInfo, null, 2),
                  );
                  toast.success("Diagnostics copied to clipboard");
                }}
                className="mt-2 px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded text-xs"
              >
                Copy Diagnostics
              </button>
            </div>
          ) : null;
        })()}

        {/* OAuth Error Alert with Retry */}
        {oauthError && canRetry && (
          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                  Connection Issue Detected
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                  {oauthError}
                </p>
                {(() => {
                  const isDevelopment =
                    window.location.hostname.includes("localhost") ||
                    window.location.hostname.includes("lovableproject.com") ||
                    window.location.hostname.includes("lovable.app");
                  return isDevelopment ? (
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                      Make sure your Meta Developer App has this redirect URI
                      configured:{" "}
                      <strong>{window.location.origin}/oauth/callback</strong>
                    </p>
                  ) : null;
                })()}
                <Button
                  onClick={cleanupStaleOAuth}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                >
                  Reset & Retry Connection
                </Button>
              </div>
            </div>
          </div>
        )}
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleConnect();
          }}
          disabled={loading || !user || !isAgeAndTermsVerified}
          className={`relative overflow-hidden px-8 w-full shadow-2xl backdrop-blur-sm border border-white/20 transition-all duration-500 group ${
            isMetaConnected
              ? "bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:via-green-600 hover:to-emerald-700 cursor-default opacity-90"
              : !isAgeAndTermsVerified
                ? "bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 cursor-not-allowed opacity-50"
                : "bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 hover:scale-105 hover:shadow-blue-500/25"
          } text-white`}
          size="lg"
          aria-label={isMetaConnected ? "Meta Connected" : "Connect Meta"}
          aria-describedby={
            isMetaConnected ? "meta-connected-tooltip" : undefined
          }
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-lg transition-opacity duration-300 group-hover:bg-white/20"></div>

          {/* Icon container with animations */}
          <div className="relative z-10 flex items-center justify-center gap-3">
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
              <Facebook className="h-4 w-4 text-white" />
            </div>
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
              <Instagram className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-white ml-2 transition-all duration-300 group-hover:text-white/90">
              {loading
                ? "Connecting..."
                : !isAgeAndTermsVerified
                  ? "Verify Age & Terms"
                  : isMetaConnected
                    ? "Connected"
                    : "Connect Meta"}
            </span>

            {/* Connected Checkmark */}
            {isMetaConnected && (
              <div
                className="ml-2 p-1 bg-white/20 rounded-full backdrop-blur-sm relative group"
                title="Meta Connected"
              >
                <CheckCircle
                  className="h-4 w-4 text-white"
                  aria-label="Meta Connected"
                />
                {/* Simple hover tooltip */}
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  Meta Connected
                </div>
              </div>
            )}
          </div>

          {/* Animated gradient overlay on hover */}
          {!isMetaConnected && (
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
          )}
        </Button>
      </div>
    </>
  );
};
