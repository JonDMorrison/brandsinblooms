
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
  const { isCompleted, isLoading: onboardingLoading } = useOnboardingStatus();
  const [timeoutReached, setTimeoutReached] = useState(false);

  console.log('🛡️ OnboardingGuard: State check', {
    user: user?.id,
    authLoading,
    onboardingLoading,
    isCompleted,
    timeoutReached,
    currentPath: window.location.pathname,
    timestamp: new Date().toISOString()
  });

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('⚠️ OnboardingGuard: Loading timeout reached - forcing fallback');
      setTimeoutReached(true);
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, []);

  // Simplified loading check - only wait for auth and onboarding
  const isLoading = authLoading || (user && onboardingLoading && !timeoutReached);

  // Show loading while checking auth or onboarding status (with timeout)
  if (isLoading) {
    console.log('⏳ OnboardingGuard: Showing loading state');
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
    console.log('🛡️ OnboardingGuard: No user, letting ProtectedRoute handle redirect');
    return <>{children}</>;
  }

  // If user is authenticated but hasn't completed onboarding, redirect to onboarding
  if (user && !isCompleted && !timeoutReached) {
    console.log('🔄 OnboardingGuard: User needs onboarding, redirecting');
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding is completed or timeout reached, show the protected content
  console.log('✅ OnboardingGuard: Onboarding completed or timeout reached, showing protected content');
  return <>{children}</>;
};
