
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";

const publicRoutes = ["/", "/landing", "/auth", "/signup", "/login", "/get-started", "/pricing"];

export const useRedirectIfAuthenticated = () => {
  const { user, loading, isInLimboState, authError } = useAuth();
  const { isCompleted, hasEverCompleted, isLoading: onboardingLoading } = useOnboardingStatus();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't redirect while auth state or onboarding status is loading
    if (loading || onboardingLoading) return;

    console.log('🔄 useRedirectIfAuthenticated check:', {
      hasUser: !!user,
      currentPath: location.pathname,
      isPublicRoute: publicRoutes.includes(location.pathname),
      isInLimboState,
      authError,
      isCompleted,
      hasEverCompleted
    });

    // If in limbo state or has auth errors, don't redirect to prevent loops
    if (isInLimboState || authError) {
      console.log('⚠️ Limbo state or auth error detected, skipping redirect');
      return;
    }

    // If user is authenticated and on any public route
    if (user && publicRoutes.includes(location.pathname)) {
      // Redirect to onboarding if user hasn't completed it, otherwise to dashboard
      if (!isCompleted && !hasEverCompleted) {
        console.log('✅ User authenticated but onboarding incomplete, redirecting to onboarding');
        navigate("/onboarding", { replace: true });
      } else {
        console.log('✅ User authenticated and onboarding complete, redirecting to dashboard');
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, loading, onboardingLoading, location.pathname, navigate, isInLimboState, authError, isCompleted, hasEverCompleted]);

  return { user, loading };
};
