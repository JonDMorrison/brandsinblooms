
import { ReactNode, useEffect, useState, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OnboardingStatusContext } from "@/contexts/OnboardingStatusContext";
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
  const location = useLocation();
  const navigate = useNavigate();
  const { setLoading, clearLoading } = useLoading();
  
  // Use context directly with fallbacks if not available
  const onboardingContext = useContext(OnboardingStatusContext);
  const isCompleted = (onboardingContext as any)?.isCompleted ?? false;
  const hasEverCompleted = (onboardingContext as any)?.hasEverCompleted ?? false;
  const hasCheckedOnce = (onboardingContext as any)?.hasCheckedOnce ?? false;
  const onboardingLoading = (onboardingContext as any)?.isLoading ?? false;
  const error = (onboardingContext as any)?.error ?? null;
  
  // Check handoff state from sessionStorage
  const inHandoff = sessionStorage.getItem('onboarding-completing') === 'true';
  
  // Use sessionStorage to persist guard state
  const [localHasCheckedOnce, setLocalHasCheckedOnce] = useState(() => {
    return sessionStorage.getItem('onboarding-checked') === 'true';
  });

  // Track when initial checks are done
  useEffect(() => {
    if (!authLoading && !onboardingLoading && hasCheckedOnce && !localHasCheckedOnce) {
      setLocalHasCheckedOnce(true);
      sessionStorage.setItem('onboarding-checked', 'true');
    }
  }, [authLoading, onboardingLoading, hasCheckedOnce, localHasCheckedOnce]);

  // Only show loading during the very first check
  const shouldShowLoading = authLoading || (onboardingLoading && !localHasCheckedOnce && !error);

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

  // Clean up stale handoff flags
  useEffect(() => {
    if (user && (isCompleted || hasEverCompleted) && inHandoff) {
      debug('Cleaning up stale handoff flag');
      sessionStorage.removeItem('onboarding-completing');
    }
  }, [user, isCompleted, hasEverCompleted, inHandoff]);
  
  // Redirect logic with strict conditions
  useEffect(() => {
    // Must have all conditions true to redirect:
    // - Not loading (auth or onboarding)
    // - Has checked at least once (prevents premature redirects)
    // - Not in handoff (prevents redirect during completion flow)
    // - Not completed and never completed (both must be false)
    // - Not already on onboarding path
    const shouldRedirect = (
      !authLoading &&
      !onboardingLoading &&
      hasCheckedOnce &&
      !inHandoff &&
      !isCompleted &&
      !hasEverCompleted &&
      location.pathname !== '/onboarding'
    );
    
    if (shouldRedirect && user) {
      debug('Redirecting to onboarding', { 
        user: !!user, 
        isCompleted, 
        hasEverCompleted,
        hasCheckedOnce,
        inHandoff,
        authLoading,
        onboardingLoading,
        pathname: location.pathname 
      });
      navigate('/onboarding', { replace: true });
    }
  }, [
    user, 
    isCompleted, 
    hasEverCompleted, 
    hasCheckedOnce, 
    inHandoff,
    authLoading, 
    onboardingLoading, 
    location.pathname, 
    navigate
  ]);

  // Allow dashboard access during handoff
  if (location.pathname.startsWith('/dashboard') && inHandoff) {
    debug('Allowing dashboard access during handoff');
    return <>{children}</>;
  }

  // Default to allowing access
  return <>{children}</>;
};
