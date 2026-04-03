
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
    console.log(`🔍 OnboardingGuard: ${message}`, data || '');
  }
};

// FIX: C1 - Add OAuth/integration callback paths to prevent losing OAuth state during onboarding
const ONBOARDING_EXEMPT_PATHS = [
  '/onboarding',
  '/auth',
  '/auth/callback',
  '/account-setup',
  '/settings',
  '/oauth/callback',
  '/integrations/lightspeed/callback',
  '/integrations/square/callback',
  '/integrations/clover/callback',
  '/integrations/mailchimp/callback',
  '/integrations/constant-contact/callback',
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

  // Only show loading during the very first auth/onboarding check
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  const shouldShowLoading = authLoading || (onboardingLoading && !hasCheckedOnce && !error);

  // Track when initial checks are done
  useEffect(() => {
    if (!authLoading && !onboardingLoading && !hasCheckedOnce) {
      setHasCheckedOnce(true);
    }
  }, [authLoading, onboardingLoading, hasCheckedOnce]);

  // Manage onboarding loading state in global context
  useEffect(() => {
    if (shouldShowLoading) {
      setLoading('onboarding', {
        isLoading: true,
        message: 'Checking your setup...',
        priority: 'onboarding'
      });
    } else {
      clearLoading('onboarding');
    }

    return () => {
      clearLoading('onboarding');
    };
  }, [shouldShowLoading, setLoading, clearLoading]);

  // Redirect incomplete users to /onboarding
  useEffect(() => {
    if (authLoading || onboardingLoading) {
      debug('Skipping redirect check — still loading', { authLoading, onboardingLoading });
      return;
    }

    // No user — let ProtectedRoute handle auth redirect
    if (!user) return;

    // FIX: C1 - Also exempt any path containing /callback (wildcard catch-all for OAuth)
    const isExempt = ONBOARDING_EXEMPT_PATHS.some(p => location.pathname.startsWith(p))
      || location.pathname.includes('/callback');
    if (isExempt) {
      debug('On exempt path, no redirect', { pathname: location.pathname });
      return;
    }

    // If onboarding is not complete and has never been completed, redirect
    if (!isCompleted && !hasEverCompleted && !error) {
      debug('Onboarding incomplete — redirecting to /onboarding', {
        isCompleted,
        hasEverCompleted,
        pathname: location.pathname,
      });
      navigate('/onboarding', { replace: true });
      return;
    }

    debug('Onboarding complete — allowing access', { pathname: location.pathname });
  }, [user, isCompleted, hasEverCompleted, error, authLoading, onboardingLoading, location.pathname, navigate]);

  // Don't render anything while loading — let GlobalLoadingOverlay handle it
  if (shouldShowLoading) {
    return null;
  }

  // If no user, let the ProtectedRoute handle the redirect
  if (!user) {
    return <>{children}</>;
  }

  // If onboarding incomplete and not on an exempt path, render nothing (redirect is pending)
  // FIX: C1 - Match wildcard callback check from redirect logic
  const isExempt = ONBOARDING_EXEMPT_PATHS.some(p => location.pathname.startsWith(p))
    || location.pathname.includes('/callback');
  if (!isCompleted && !hasEverCompleted && !error && !isExempt) {
    return null;
  }

  return <>{children}</>;
};
