
import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";

interface OnboardingGuardProps {
  children: ReactNode;
}

const debug = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
    console.log(`🔍 OnboardingGuard: ${message}`, data || '');
  }
};

export const OnboardingGuard = ({ children }: OnboardingGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isCompleted, hasEverCompleted, isLoading: onboardingLoading, error } = useOnboardingStatus();
  const { setLoading, clearLoading } = useLoading();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Use sessionStorage to persist across navigation - this prevents loading on every route change
  const [hasCheckedOnce, setHasCheckedOnce] = useState(() => {
    return sessionStorage.getItem('onboarding-checked') === 'true';
  });

  // Track when initial checks are done
  useEffect(() => {
    if (!authLoading && !onboardingLoading && !hasCheckedOnce) {
      setHasCheckedOnce(true);
      sessionStorage.setItem('onboarding-checked', 'true');
    }
  }, [authLoading, onboardingLoading, hasCheckedOnce]);

  // Only show loading during the very first auth/onboarding check
  const shouldShowLoading = authLoading || (onboardingLoading && !hasCheckedOnce && !error);

  // Manage onboarding loading state in global context
  useEffect(() => {
    if (shouldShowLoading) {
      setLoading('onboarding', {
        isLoading: true,
        message: 'Checking your setup...',
        priority: 'onboarding'
      });
    } else {
      clearLoading('onboarding');
    }
  }, [shouldShowLoading, setLoading, clearLoading]);

  // Don't render anything while loading - let GlobalLoadingOverlay handle it
  if (shouldShowLoading) {
    return null;
  }

  // If no user, let the ProtectedRoute handle the redirect
  if (!user) {
    return <>{children}</>;
  }

  // Reactive redirect logic using router location
  const inHandoff = sessionStorage.getItem('onboarding-completing') === 'true';
  
  useEffect(() => {
    // Don't redirect during loading states or handoff
    if (authLoading || onboardingLoading || inHandoff) {
      debug('Skipping redirect check', { authLoading, onboardingLoading, inHandoff });
      return;
    }
    
    // Don't redirect if already on onboarding path
    if (location.pathname.startsWith('/onboarding')) {
      debug('Already on onboarding path, no redirect needed');
      return;
    }
    
    // Allow dashboard access to prevent bounce
    if (location.pathname.startsWith('/dashboard')) {
      debug('Allowing dashboard access to prevent bounce');
      return;
    }
    
    // Only redirect if we have a user, onboarding is incomplete (both flags), and we've checked at least once
    if (user && !isCompleted && !hasEverCompleted && !error && hasCheckedOnce) {
      debug('Redirecting to onboarding', { 
        user: !!user, 
        isCompleted, 
        hasEverCompleted,
        error, 
        hasCheckedOnce,
        pathname: location.pathname 
      });
      navigate('/onboarding', { replace: true });
    }
  }, [user, isCompleted, hasEverCompleted, error, hasCheckedOnce, authLoading, onboardingLoading, inHandoff, location.pathname, navigate]);

  // Allow dashboard access during handoff even if status hasn't updated yet
  if (location.pathname === '/dashboard' && inHandoff) {
    debug('Allowing dashboard access during handoff');
    return <>{children}</>;
  }

  // Default to allowing access - better user experience than blocking
  return <>{children}</>;
};
