
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { OnboardingGuard } from "@/components/OnboardingGuard";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Track when auth has initially loaded to prevent remounting
  useEffect(() => {
    if (!loading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [loading, hasInitiallyLoaded]);

  // Show loading only on initial load, not subsequent loading states
  if (loading && !hasInitiallyLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garden-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-primary font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <OnboardingGuard>
      {children}
    </OnboardingGuard>
  );
};
