
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const publicRoutes = ["/", "/landing", "/auth", "/signup", "/login", "/get-started", "/pricing"];

export const useRedirectIfAuthenticated = () => {
  const { user, loading, isInLimboState, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't redirect while auth state is loading
    if (loading) return;

    console.log('🔄 useRedirectIfAuthenticated check:', {
      hasUser: !!user,
      currentPath: location.pathname,
      isPublicRoute: publicRoutes.includes(location.pathname),
      isInLimboState,
      authError
    });

    // If in limbo state or has auth errors, don't redirect to prevent loops
    if (isInLimboState || authError) {
      console.log('⚠️ Limbo state or auth error detected, skipping redirect');
      return;
    }

    // If user is authenticated and on any public route, redirect to dashboard
    if (user && publicRoutes.includes(location.pathname)) {
      console.log('✅ User authenticated on public route, redirecting to dashboard');
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, location.pathname, navigate, isInLimboState, authError]);

  return { user, loading };
};
