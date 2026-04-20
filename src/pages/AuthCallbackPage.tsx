import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Facebook,
  Instagram,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FacebookAppSetupGuide } from "@/components/social/FacebookAppSetupGuide";
import { getOAuthRedirectUri } from "@/utils/environmentUtils";

interface ProviderResults {
  facebook?: {
    connected: boolean;
    pages: Array<{ id: string; name: string }>;
    error: string | null;
  };
  instagram?: {
    connected: boolean;
    accounts: Array<{ id: string; username: string }>;
    error: string | null;
    errorCode: string | null;
  };
}

type ProviderIntent = "facebook" | "instagram";

function getMetaFailureMessage(
  providerIntent: ProviderIntent,
  providerResults?: ProviderResults,
  fallback?: string,
) {
  if (providerIntent === "instagram") {
    return (
      providerResults?.instagram?.error ||
      fallback ||
      "Instagram connection failed. Please try again."
    );
  }

  return (
    providerResults?.facebook?.error ||
    fallback ||
    "Facebook connection failed. Please try again."
  );
}

function getMetaSuccessMessage(
  providerIntent: ProviderIntent,
  providerResults?: ProviderResults,
) {
  const facebookPages = providerResults?.facebook?.pages || [];
  const instagramAccounts = providerResults?.instagram?.accounts || [];

  if (providerIntent === "instagram") {
    if (instagramAccounts.length > 0 && facebookPages.length > 0) {
      return `Instagram connected successfully (${instagramAccounts
        .map((account) => `@${account.username}`)
        .join(", ")}). Facebook Page access is ready too.`;
    }

    if (instagramAccounts.length > 0) {
      return `Instagram connected successfully (${instagramAccounts
        .map((account) => `@${account.username}`)
        .join(", ")}).`;
    }

    return "Instagram connected successfully.";
  }

  if (facebookPages.length > 0) {
    return `Facebook connected successfully (${facebookPages
      .map((page) => page.name)
      .join(", ")}).`;
  }

  return "Facebook connected successfully.";
}

export const AuthCallbackPage = () => {
  // ──────────────────────────────────────────────
  // HOT-FIX: Facebook sometimes returns /auth/callback#/?code=…&state=…
  // Values after "#" are invisible to window.location.search.
  // Move them back into the querystring **before** we parse params.
  if (window.location.hash.startsWith("#/?")) {
    const fixed = window.location.hash.replace(/^#\/?/, "?");
    window.history.replaceState(null, "", window.location.pathname + fixed);
  }
  // ──────────────────────────────────────────────

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [message, setMessage] = useState("Connecting to Meta platform...");
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [showAppSetupGuide, setShowAppSetupGuide] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);
  const exchangeStartedRef = useRef(false); // Prevent duplicate exchange attempts
  const navigationTimerRef = useRef<NodeJS.Timeout | null>(null); // Track navigation timers for cleanup

  // Cleanup navigation timers on unmount
  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  // Safe navigation helper with error handling
  const safeNavigate = (path: string, delay: number = 0) => {
    try {
      // Clear any existing timer
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }

      if (delay === 0) {
        navigate(path);
      } else {
        navigationTimerRef.current = setTimeout(() => {
          navigate(path);
        }, delay);
      }
    } catch (error) {
      console.error("❌ Safe navigation error:", error);
      // Last resort: direct browser navigation
      window.location.href = path;
    }
  };

  useEffect(() => {
    // Only handle OAuth callback logic if we're actually on the callback route
    if (window.location.pathname !== "/auth/callback") {
      return;
    }

    const handleCallback = async () => {
      // CRITICAL: Check ref FIRST to prevent any duplicate processing
      if (exchangeStartedRef.current) {
        return;
      }

      // Get parameters from URL
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription =
        searchParams.get("error_description") ||
        searchParams.get("errorDescription");

      // Clear URL parameters to prevent reuse
      if (code || error) {
        const newUrl =
          window.location.protocol +
          "//" +
          window.location.host +
          window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }

      // Handle OAuth errors
      if (error) {
        console.error("OAuth error:", error, errorDescription);
        setStatus("error");

        // Detect specific Facebook errors
        if (
          error === "access_denied" &&
          errorDescription?.toLowerCase().includes("not active")
        ) {
          setMessage(
            "The Facebook app is not active or you need to be added as a test user.",
          );
          setShowAppSetupGuide(true);
        } else if (error === "access_denied") {
          setMessage(
            "You declined to authorize the connection. Please try again if you want to connect your accounts.",
          );
        } else {
          setMessage(`Authorization failed: ${errorDescription || error}`);
        }

        safeNavigate("/social-accounts", 8000);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        console.error("Missing required parameters:", {
          code: !!code,
          state: !!state,
        });
        setStatus("error");
        setMessage("Missing authorization code or state parameter");

        safeNavigate("/social-accounts", 3000);
        return;
      }

      // CRITICAL: Prevent duplicate exchanges with state flag
      if (exchangeStartedRef.current || isExchanging) {
        return;
      }

      // Note: Duplicate exchanges are now guarded by the isExchanging flag
      // and backend idempotency / code-usage tracking in the exchange-oauth-code function.

      // CHECK 1: Wait for auth to load FIRST (before state validation)
      if (authLoading) {
        setMessage("Verifying authentication...");
        return;
      }

      // CHECK 2: Verify user is authenticated BEFORE state validation
      if (!user) {
        console.error("❌ No authenticated user during OAuth callback");
        setStatus("error");
        setMessage("You must be logged in to connect social media accounts");
        safeNavigate("/auth", 3000);
        return;
      }

      // CHECK 3: ONLY NOW validate state (user is confirmed authenticated)
      const storedState = sessionStorage.getItem("oauth_state");
      const backupState = localStorage.getItem("oauth_state_backup");
      const primaryBackup = localStorage.getItem("oauth_state_primary");
      const storedProviderIntent =
        (sessionStorage.getItem(
          "oauth_provider_intent",
        ) as ProviderIntent | null) || "facebook";

      const hasStoredState = !!(storedState || backupState || primaryBackup);
      const stateMatches =
        state === storedState ||
        state === backupState ||
        state === primaryBackup;

      if (hasStoredState && !stateMatches) {
        console.error(
          "❌ State mismatch - security verification failed (stored state exists but does not match)",
        );
        setStatus("error");
        setMessage(
          "Security verification failed. Please try connecting again from Social Accounts.",
        );
        safeNavigate("/social-accounts", 3000);
        return;
      }

      // Clear stored states after successful validation
      sessionStorage.removeItem("oauth_state");
      localStorage.removeItem("oauth_state_backup");
      localStorage.removeItem("oauth_state_primary");
      sessionStorage.removeItem("oauth_provider_intent");

      // CRITICAL: Set ref IMMEDIATELY before any async work
      exchangeStartedRef.current = true;

      // Set exchange flag to prevent concurrent calls
      setIsExchanging(true);

      try {
        setMessage("Exchanging authorization code...");

        const redirectUri = getOAuthRedirectUri("/auth/callback");
        console.log(`🔁 OAuth exchange redirect URI: ${redirectUri}`);

        const exchangePayload = {
          code,
          state,
          // Must match the URL authorized with Facebook
          redirect_uri: redirectUri,
        };
        const { data, error: exchangeError } = await supabase.functions.invoke(
          "exchange-oauth-code",
          {
            body: exchangePayload,
          },
        );

        const providerIntent =
          (data?.providerIntent as ProviderIntent | undefined) ||
          storedProviderIntent;
        const providerResults = data?.providerResults as
          | ProviderResults
          | undefined;

        if (exchangeError || !data?.success) {
          let errorMessage = getMetaFailureMessage(
            providerIntent,
            providerResults,
            exchangeError?.message || data?.error || data?.message,
          );

          // Handle specific error stages with user-friendly messages
          if (data?.stage === "fetch_pages") {
            errorMessage = `Unable to fetch your Facebook Pages from Meta. ${data.meta_error || ""}\n\nThis usually happens when:\n• You don't have admin access to any Facebook Pages\n• Pages weren't selected during the connection process\n• The app doesn't have the required permissions\n\nPlease:\n1. Go to facebook.com/settings?tab=business_tools\n2. Remove BloomSuite from Business Integrations\n3. Try connecting again and grant all permissions\n4. Make sure to select at least one Page you manage`;
          } else if (data?.stage === "no_pages") {
            errorMessage = `No Facebook Pages were found for your account.\n\nPlease ensure:\n• You are an admin on at least one Facebook Page\n• You selected your Page(s) during the Meta authorization\n• You're using the correct Facebook account\n\nTry:\n1. Logging into the Facebook account that owns your Page\n2. Reconnecting from BloomSuite\n3. Selecting all Pages you want to connect when prompted`;
          }

          sessionStorage.setItem(
            "social_connection_failure",
            JSON.stringify({
              errorCode: providerResults?.instagram?.errorCode || null,
              message: errorMessage,
              providerIntent,
              providerResults,
              timestamp: Date.now(),
            }),
          );

          throw new Error(errorMessage);
        }

        // Success!
        setStatus("success");
        const successMessage = getMetaSuccessMessage(
          providerIntent,
          providerResults,
        );
        setMessage(successMessage);

        const successfulPlatforms: string[] = [];
        if (providerResults?.facebook?.connected) {
          successfulPlatforms.push("facebook");
        }
        if (providerResults?.instagram?.connected) {
          successfulPlatforms.push("instagram");
        }
        setConnectedPlatforms(successfulPlatforms);

        // Set success flag for social accounts page with platform details
        sessionStorage.setItem(
          "social_connection_success",
          JSON.stringify({
            message: successMessage,
            platforms: successfulPlatforms,
            providerIntent,
            providerResults,
            timestamp: Date.now(),
          }),
        );

        // CRITICAL FIX: Use safeNavigate without window.location.search (already cleared)
        safeNavigate("/social-accounts", 3000);
      } catch (error: any) {
        console.error("OAuth exchange error:", error);

        setStatus("error");
        setMessage(
          error.message || "Failed to connect Meta account. Please try again.",
        );
        safeNavigate("/social-accounts", 5000);
      } finally {
        // Always reset the exchanging flag
        setIsExchanging(false);
      }
    };

    // Only handle callback if we have OAuth parameters
    const hasOAuthParams =
      !!searchParams.get("code") ||
      !!searchParams.get("error") ||
      !!searchParams.get("status");

    if (hasOAuthParams) {
      handleCallback().catch((error) => {
        console.error("❌ Uncaught callback error:", error);
        setStatus("error");
        setMessage("An unexpected error occurred");

        safeNavigate("/social-accounts", 3000);
      });
    } else {
      safeNavigate("/social-accounts", 2000);
    }
  }, [searchParams, navigate, user, authLoading, isExchanging]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-lg border-0 shadow-xl">
        <CardContent className="p-6 md:p-8">
          {status === "processing" && (
            <div className="text-center space-y-6">
              {/* Meta Branding */}
              <div className="flex justify-center items-center space-x-3">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <Facebook className="w-8 h-8 text-white" />
                </div>
                <div className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl">
                  <Instagram className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Loading Animation */}
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-background rounded-full" />
                </div>
              </div>

              {/* Progress Text */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Connecting to Meta</h2>
                <p className="text-muted-foreground text-lg">{message}</p>
              </div>

              {/* Progress Steps */}
              <div className="flex justify-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-primary/25 animate-pulse delay-150" />
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-6">
              {/* Success Animation */}
              <div className="relative">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
                {/* Celebration Effect */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 border-4 border-green-200 rounded-full animate-ping opacity-75" />
                </div>
              </div>

              {/* Success Message */}
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-green-700">
                  Successfully Connected!
                </h2>
                <p className="text-muted-foreground">{message}</p>

                {/* Connected Platforms */}
                {connectedPlatforms.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Connected platforms:</p>
                    <div className="flex justify-center gap-2">
                      {connectedPlatforms.map((platform) => (
                        <div
                          key={platform}
                          className="flex items-center gap-1 px-3 py-1 bg-green-50 rounded-full"
                        >
                          {platform === "facebook" && (
                            <Facebook className="w-4 h-4 text-blue-600" />
                          )}
                          {platform === "instagram" && (
                            <Instagram className="w-4 h-4 text-purple-600" />
                          )}
                          <span className="text-sm font-medium capitalize">
                            {platform}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Taking you to your accounts...</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => safeNavigate("/social-accounts", 0)}
                  className="w-full"
                >
                  Continue to Accounts
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-6">
              {/* Error Icon */}
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>

              {/* Error Message */}
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-red-700">
                  Connection Failed
                </h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {message}
                </p>
              </div>

              {/* Show Facebook App Setup Guide for specific errors */}
              {showAppSetupGuide && (
                <div className="mt-6 text-left">
                  <FacebookAppSetupGuide isAdmin={true} />
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => safeNavigate("/social-accounts", 0)}
                  className="w-full"
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => safeNavigate("/social-accounts", 0)}
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Accounts
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Redirecting automatically in a few seconds...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallbackPage;
