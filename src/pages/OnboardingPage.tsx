
import { SimplifiedOnboardingFlow } from "@/components/onboarding/SimplifiedOnboardingFlow";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { EnhancedErrorBoundary } from "@/components/onboarding/EnhancedErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const OnboardingPage = () => {
  const { user, loading } = useAuth();
  const { isCompleted, isLoading: onboardingLoading, markAsCompleted, refreshStatus } = useOnboardingStatus();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔍 OnboardingPage: Auth state check - user:', user?.id, 'loading:', loading);
    
    // If not loading and no user, redirect to auth
    if (!loading && !user) {
      console.log('🔄 OnboardingPage: No authenticated user, redirecting to auth');
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // Redirect to dashboard if onboarding is already complete
  useEffect(() => {
    if (!loading && !onboardingLoading && user && isCompleted) {
      console.log('✅ OnboardingPage: Onboarding already complete, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, onboardingLoading, isCompleted, navigate]);

  const handleOnboardingComplete = async (data: any) => {
    if (!user) {
      console.error('❌ OnboardingPage: No user found during onboarding completion');
      navigate('/auth', { replace: true });
      return;
    }

    try {
      console.log('✅ OnboardingPage: Starting completion process for user:', user.id);
      
      // Set handoff flag to prevent guard redirects
      sessionStorage.setItem('onboarding-completing', 'true');
      
      // Store the onboarding data in localStorage for the main app to pick up
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(data));
      console.log('📱 OnboardingPage: Data stored in localStorage');
      
      // Mark as completed with company name from data
      console.log('🔄 OnboardingPage: Marking onboarding as completed');
      await markAsCompleted({ 
        company_name: data.companyName || data.businessName || 'My Company' 
      });
      
      // Set user-specific sticky completion flag
      localStorage.setItem(`onboarding-has-completed:${user.id}`, '1');
      console.log('💾 OnboardingPage: Set user-specific completion flag');
      
      // Force refresh the status to ensure consistency
      await refreshStatus();
      
      // Small delay to ensure state propagation
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Navigate directly to dashboard
      console.log('🎯 OnboardingPage: Navigating to dashboard after completion');
      navigate('/dashboard', { replace: true });
      
      // Clear handoff flag after navigation
      setTimeout(() => {
        sessionStorage.removeItem('onboarding-completing');
        console.log('🧹 OnboardingPage: Cleared completion flag');
      }, 800);
      
    } catch (error) {
      console.error('❌ OnboardingPage: Error during completion:', error);
      sessionStorage.removeItem('onboarding-completing');
      throw error;
    }
  };

  const handleReset = () => {
    // Clear any stuck onboarding data
    if (user) {
      localStorage.removeItem(`garden-center-onboarding-${user.id}`);
      localStorage.removeItem(`onboarding-progress-${user.id}`);
    }
  };

  // Show loading while auth or onboarding status is being determined
  if (loading || onboardingLoading) {
    console.log('⏳ OnboardingPage: Showing loading state');
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-garden-green" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user after loading, don't render (will redirect)
  if (!user) {
    console.log('🚫 OnboardingPage: No user authenticated, returning null');
    return null;
  }

  console.log('🎯 OnboardingPage: Rendering onboarding flow for user:', user.id);

  // Check if we should show manual entry flow or simplified flow
  const isManualFlow = window.location.pathname === '/onboarding/manual';
  
  return (
    <EnhancedErrorBoundary onReset={handleReset}>
      <div className="min-h-screen bg-garden-background">
        {isManualFlow ? (
          <OnboardingFlow onComplete={handleOnboardingComplete} />
        ) : (
          <SimplifiedOnboardingFlow onComplete={handleOnboardingComplete} />
        )}
      </div>
    </EnhancedErrorBoundary>
  );
};

export default OnboardingPage;
