
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface OnboardingGuardProps {
  children: ReactNode;
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { loading: subscriptionLoading } = useSubscription();
  const { isCompleted, isLoading: onboardingLoading } = useOnboardingStatus();

  console.log('🛡️ OnboardingGuard: State check', {
    user: user?.id,
    authLoading,
    subscriptionLoading, 
    onboardingLoading,
    isCompleted,
    currentPath: window.location.pathname,
    timestamp: new Date().toISOString()
  });

  // Show loading while checking auth, subscription, or onboarding status
  if (authLoading || subscriptionLoading || onboardingLoading) {
    console.log('⏳ OnboardingGuard: Showing loading state');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-green-600 font-medium">Checking your setup...</p>
        </div>
      </div>
    );
  }

  // If no user, let the ProtectedRoute handle the redirect
  if (!user) {
    console.log('🛡️ OnboardingGuard: No user, letting ProtectedRoute handle redirect');
    return <>{children}</>;
  }

  // TEMPORARY DEBUG: Skip onboarding check if we're in a loop
  const hasOnboardingData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
  if (hasOnboardingData && !isCompleted) {
    console.log('🔧 OnboardingGuard: Found onboarding data in localStorage but DB shows incomplete, allowing access');
    return <>{children}</>;
  }

  // If user is authenticated but hasn't completed onboarding, redirect to onboarding
  if (user && !isCompleted && !hasOnboardingData) {
    console.log('🔄 OnboardingGuard: User needs onboarding, redirecting');
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding is completed, show the protected content
  console.log('✅ OnboardingGuard: Onboarding completed or bypassed, showing protected content');
  return <>{children}</>;
};
