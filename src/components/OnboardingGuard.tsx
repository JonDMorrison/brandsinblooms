
import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingGuardProps {
  children: ReactNode;
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isCompleted, isLoading: onboardingLoading, error: onboardingError } = useOnboardingStatus();
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

  const shouldShowLoading = authLoading || 
    (user && onboardingLoading && !timeoutReached && !hasCheckedOnce && !onboardingError);

  // Debug logging
  console.log('🔍 OnboardingGuard state:', {
    authLoading,
    onboardingLoading,
    timeoutReached,
    hasCheckedOnce,
    onboardingError,
    shouldShowLoading,
    isCompleted,
    userExists: !!user
  });

  // Show loading while checking auth or onboarding status (with timeout)
  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-green-600 font-medium">
            {timeoutReached ? 'Loading is taking longer than expected...' : 'Checking your setup...'}
          </p>
          {timeoutReached && (
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Refresh Page
            </button>
          )}
        </div>
      </div>
    );
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
