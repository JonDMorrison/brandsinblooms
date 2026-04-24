import React, { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";

interface OnboardingGuardProps {
  children: ReactNode;
}

const debug = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
  }
};

// FIX: C1 - Add OAuth/integration callback paths to prevent losing OAuth state during onboarding
const ONBOARDING_EXEMPT_PATHS = [
  "/onboarding",
  "/auth",
  "/auth/callback",
  "/account-setup",
  "/settings",
  "/oauth/callback",
  "/integrations/lightspeed/callback",
  "/integrations/square/callback",
  "/integrations/clover/callback",
  "/integrations/mailchimp/callback",
  "/integrations/constant-contact/callback",
];

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const onboardingStatus = useOnboardingStatus();
  const { setLoading, clearLoading } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();

  // Safely extract values with fallbacks
  const isCompleted = onboardingStatus?.isCompleted ?? false;
  const hasEverCompleted = onboardingStatus?.hasEverCompleted ?? false;
  const onboardingLoading = onboardingStatus?.isLoading ?? false;
  const error = onboardingStatus?.error ?? null;

  // Use sessionStorage to persist across navigation - this prevents loading on every route change
  const [hasCheckedOnce, setHasCheckedOnce] = useState(() => {
    return sessionStorage.getItem("onboarding-checked") === "true";
  });

  // Clean up stale handoff flags and reactive redirect logic
  const inHandoff = sessionStorage.getItem("onboarding-completing") === "true";

  // Only show loading during the very first auth/onboarding check
  const shouldShowLoading =
    authLoading || (onboardingLoading && !hasCheckedOnce && !error);

  // Track when initial checks are done
  useEffect(() => {
    if (!authLoading && !onboardingLoading && !hasCheckedOnce) {
      setHasCheckedOnce(true);
      sessionStorage.setItem("onboarding-checked", "true");
    }
  }, [authLoading, onboardingLoading, hasCheckedOnce]);

  // Manage onboarding loading state in global context
  useEffect(() => {
    if (shouldShowLoading) {
      setLoading("onboarding", {
        isLoading: true,
        message: "Checking your setup...",
        priority: "onboarding",
      });
    } else {
      clearLoading("onboarding");
    }

    // Always clear onboarding loading on unmount
    return () => {
      clearLoading("onboarding");
    };
  }, [shouldShowLoading, setLoading, clearLoading]);

  // Redirect incomplete users to /onboarding
  useEffect(() => {
    if (user && (isCompleted || hasEverCompleted) && inHandoff) {
      debug("Cleaning up stale handoff flag");
      sessionStorage.removeItem("onboarding-completing");
    }
  }, [user, isCompleted, hasEverCompleted, inHandoff]);

  useEffect(() => {
    // Don't redirect during loading states or handoff
    if (authLoading || onboardingLoading || inHandoff) {
      debug("Skipping redirect check", {
        authLoading,
        onboardingLoading,
        inHandoff,
      });
      return;
    }

    // Don't redirect if already on onboarding path
    if (location.pathname.startsWith("/onboarding")) {
      debug("Already on onboarding path, no redirect needed");
      return;
    }

    // Allow access to dashboard for all authenticated users
    // The dashboard will show setup wizard if onboarding is incomplete
    debug("Allowing dashboard access", {
      user: !!user,
      isCompleted,
      hasEverCompleted,
      error,
      hasCheckedOnce,
      pathname: location.pathname,
    });
  }, [
    user,
    isCompleted,
    hasEverCompleted,
    error,
    hasCheckedOnce,
    authLoading,
    onboardingLoading,
    inHandoff,
    location.pathname,
    navigate,
  ]);

  // Don't render anything while loading — let GlobalLoadingOverlay handle it
  if (shouldShowLoading) {
    return null;
  }

  // No user — let ProtectedRoute handle auth redirect
  if (!user) return;

  // FIX: C1 - Also exempt any path containing /callback (wildcard catch-all for OAuth)
  const isExempt =
    ONBOARDING_EXEMPT_PATHS.some((p) => location.pathname.startsWith(p)) ||
    location.pathname.includes("/callback");
  if (isExempt) {
    debug("On exempt path, no redirect", { pathname: location.pathname });
    return <>{children}</>;
  }

  // Allow dashboard access during handoff even if status hasn't updated yet
  if (location.pathname === "/dashboard" && inHandoff) {
    debug("Allowing dashboard access during handoff");
    return <>{children}</>;
  }

  // hasEverCompleted (from localStorage) is the authoritative signal.
  // Once set, the user completed onboarding — even if the background
  // edge function hasn't written onboarding_completed_at to the DB yet.
  if (hasEverCompleted) {
    debug("hasEverCompleted=true — allowing access", {
      pathname: location.pathname,
    });
    return <>{children}</>;
  }

  // DB says complete — allow through
  if (isCompleted) {
    debug("isCompleted=true — allowing access", {
      pathname: location.pathname,
    });
    return <>{children}</>;
  }

  // If there was an error checking status, don't trap the user
  if (error) {
    debug("Error checking onboarding status — allowing access", { error });
    return <>{children}</>;
  }

  // Onboarding genuinely not complete — redirect
  debug("Onboarding incomplete — redirecting to /onboarding", {
    isCompleted,
    hasEverCompleted,
    pathname: location.pathname,
  });
  navigate("/onboarding", { replace: true });
  return null;
};
