
import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";

interface OnboardingGuardProps {
  children: ReactNode;
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isCompleted, isLoading: onboardingLoading, error: onboardingError } = useOnboardingStatus();
  const { setLoading, clearLoading } = useLoading();
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  // Track when initial checks are done
  useEffect(() => {
    if (!authLoading && !onboardingLoading) {
      setHasCheckedOnce(true);
    }
  }, [authLoading, onboardingLoading]);

  // Simplified loading logic - only show loading during auth or initial onboarding check
  const shouldShowLoading = authLoading || (onboardingLoading && !onboardingError);

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
  const shouldRedirectToOnboarding = user && 
    !isCompleted && 
    !onboardingError &&
    hasCheckedOnce &&
    window.location.pathname !== '/onboarding';

  console.log('🔍 OnboardingGuard: Decision state', {
    user: !!user,
    isCompleted,
    onboardingError,
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
