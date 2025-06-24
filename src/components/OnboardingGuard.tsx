
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

  // Show loading while checking auth, subscription, or onboarding status
  if (authLoading || subscriptionLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-green-600 font-medium">Checking your setup...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but hasn't completed onboarding, redirect to onboarding
  if (user && !isCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding is completed, show the protected content
  return <>{children}</>;
};
