
import { SimplifiedOnboardingFlow } from "@/components/onboarding/SimplifiedOnboardingFlow";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { EnhancedErrorBoundary } from "@/components/onboarding/EnhancedErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const OnboardingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔍 OnboardingPage: Auth state check - user:', user?.id, 'loading:', loading);
    
    // If not loading and no user, redirect to auth
    if (!loading && !user) {
      console.log('🔄 OnboardingPage: No authenticated user, redirecting to auth');
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleOnboardingComplete = (data: any) => {
    console.log('✅ OnboardingPage: Onboarding completed for user:', user?.id, 'data:', data);
    
    if (user) {
      // Store the onboarding data in localStorage for the main app to pick up
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(data));
      console.log('📱 OnboardingPage: Data stored in localStorage');
      
      // Immediately navigate without delay to prevent race conditions
      console.log('🎯 OnboardingPage: Navigating to dashboard after completion');
      navigate('/', { replace: true });
    } else {
      console.error('❌ OnboardingPage: No user found during onboarding completion');
      navigate('/auth', { replace: true });
    }
  };

  const handleReset = () => {
    // Clear any stuck onboarding data
    if (user) {
      localStorage.removeItem(`garden-center-onboarding-${user.id}`);
      localStorage.removeItem(`onboarding-progress-${user.id}`);
    }
  };

  // Show loading while auth is being determined
  if (loading) {
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
