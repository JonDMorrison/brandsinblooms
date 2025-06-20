
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const publicRoutes = ["/", "/landing", "/auth", "/signup", "/login", "/get-started", "/pricing"];

export const useRedirectIfAuthenticated = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't redirect while auth state is loading
    if (loading) return;

    // If user is authenticated and on any public route, redirect to unified dashboard
    if (user && publicRoutes.includes(location.pathname)) {
      console.log('User authenticated on public route, redirecting to unified dashboard');
      navigate("/app", { replace: true });
    }

    // Redirect legacy dashboard routes to unified dashboard
    if (user && (location.pathname === "/dashboard" || location.pathname === "/home")) {
      console.log('Redirecting legacy dashboard route to unified dashboard');
      navigate("/app", { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  return { user, loading };
};
