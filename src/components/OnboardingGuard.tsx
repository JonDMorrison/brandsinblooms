
import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";

interface OnboardingGuardProps {
  children: ReactNode;
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isCompleted, isLoading: onboardingLoading, error } = useOnboardingStatus();
  const { setLoading, clearLoading } = useLoading();
  
  // Use sessionStorage to persist across navigation - this prevents loading on every route change
  const [hasCheckedOnce, setHasCheckedOnce] = useState(() => {
    return sessionStorage.getItem('onboarding-checked') === 'true';
  });

  // Track when initial checks are done
  useEffect(() => {
    if (!authLoading && !onboardingLoading && !hasCheckedOnce) {
      setHasCheckedOnce(true);
      sessionStorage.setItem('onboarding-checked', 'true');
    }
  }, [authLoading, onboardingLoading, hasCheckedOnce]);

  // Only show loading during the very first auth/onboarding check
  const shouldShowLoading = authLoading || (onboardingLoading && !hasCheckedOnce && !error);

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
  }, [shouldShowLoading, setLoading, clearLoading]);

  // Don't render anything while loading - let GlobalLoadingOverlay handle it
  if (shouldShowLoading) {
    return null;
  }

  // If no user, let the ProtectedRoute handle the redirect
  if (!user) {
    return <>{children}</>;
  }

  // Simplified redirect logic - only redirect if we're certain onboarding is incomplete
  // Don't redirect from onboarding paths to prevent loops
  const shouldRedirectToOnboarding = user && 
    !isCompleted && 
    !error &&
    hasCheckedOnce &&
    !window.location.pathname.startsWith('/onboarding');

  console.log('🔍 OnboardingGuard: Decision state', {
    user: !!user,
    isCompleted,
    error,
    hasCheckedOnce,
    pathname: window.location.pathname,
    shouldRedirect: shouldRedirectToOnboarding
  });

  if (shouldRedirectToOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Default to allowing access - better user experience than blocking
  return <>{children}</>;
};
