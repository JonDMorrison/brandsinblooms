
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
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  // Production ready state check

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      setTimeoutReached(true);
    }, 5000); // Reduced timeout to 5 seconds

    return () => clearTimeout(timeout);
  }, []);

  // Track when we've completed our first check
  useEffect(() => {
    if (!authLoading && !onboardingLoading) {
      setHasCheckedOnce(true);
    }
  }, [authLoading, onboardingLoading]);

  // If there's an onboarding error and we've timed out, assume incomplete
  const shouldShowLoading = authLoading || 
    (user && onboardingLoading && !timeoutReached && !hasCheckedOnce && !onboardingError);

  // Manage onboarding loading state in global context
  useEffect(() => {
    if (shouldShowLoading) {
      setLoading('onboarding', {
        isLoading: true,
        message: timeoutReached ? 'Loading is taking longer than expected...' : 'Checking your setup...',
        priority: 'onboarding'
      });
    } else {
      clearLoading('onboarding');
    }
  }, [shouldShowLoading, timeoutReached, setLoading, clearLoading]);

  // Don't render anything while loading - let GlobalLoadingOverlay handle it
  if (shouldShowLoading) {
    return null;
  }

  // If no user, let the ProtectedRoute handle the redirect
  if (!user) {
    return <>{children}</>;
  }

  // Enhanced logic to handle various completion states
  const shouldRedirectToOnboarding = user && 
    !isCompleted && 
    !timeoutReached && 
    hasCheckedOnce && 
    !onboardingError &&
    window.location.pathname !== '/onboarding';

  if (shouldRedirectToOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // If we have an error, timeout, or onboarding is completed, allow access
  return <>{children}</>;
};
