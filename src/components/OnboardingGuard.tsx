
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingGuardProps {
  children: ReactNode;
}

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isCompleted, isLoading } = useOnboardingStatus();

  // Show loading while checking auth or onboarding status
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garden-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-primary font-medium">Checking your setup...</p>
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
