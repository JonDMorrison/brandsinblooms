
import { SimplifiedOnboardingFlow } from "@/components/onboarding/SimplifiedOnboardingFlow";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { EnhancedErrorBoundary } from "@/components/onboarding/EnhancedErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

const OnboardingPage = () => {
  const { user, loading } = useAuth();
  const { isCompleted, isLoading: onboardingLoading, markAsCompleted, refreshStatus } = useOnboardingStatus();
  const navigate = useNavigate();
  const [showSetupComplete, setShowSetupComplete] = useState(false);

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
      
      // Mark as completed immediately to prevent race conditions
      console.log('🔄 OnboardingPage: Marking onboarding as completed');
      await markAsCompleted();
      
      // Set user-specific sticky completion flag
      localStorage.setItem(`onboarding-has-completed:${user.id}`, '1');
      console.log('💾 OnboardingPage: Set user-specific completion flag');
      
      // Force refresh the status to ensure consistency
      await refreshStatus();
      
      // Small delay to ensure state propagation
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Show the "setup complete" screen before going to dashboard
      setShowSetupComplete(true);
      
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

  // Post-onboarding success screen
  if (showSetupComplete) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your account is ready!</h1>
            <p className="text-gray-600">You can now access BloomSuite anytime from:</p>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Bookmark className="w-4 h-4" />
              <span className="font-medium">Bookmark your login page</span>
            </div>
            <code className="font-mono text-sm font-semibold text-gray-900 select-all break-words">
              https://bloomsuite.app/auth
            </code>
            <p className="text-xs text-gray-500">
              Use this URL anytime to sign in. Save it now so you always know where to go.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              sessionStorage.removeItem('onboarding-completing');
              navigate('/dashboard', { replace: true });
            }}
          >
            Go to My Dashboard →
          </Button>
        </div>
      </div>
    );
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
