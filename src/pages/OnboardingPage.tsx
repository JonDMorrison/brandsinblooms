
import { WebsiteOnboardingFlow } from "@/components/WebsiteOnboardingFlow";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const OnboardingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If not loading and no user, redirect to auth
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleOnboardingComplete = (data: any) => {
    console.log('Onboarding completed:', data);
    if (user) {
      // Store the onboarding data in localStorage for the main app to pick up
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(data));
      // Navigate to the main app
      navigate('/app', { replace: true });
    }
  };

  // Show loading while auth is being determined
  if (loading) {
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
    return null;
  }

  return (
    <div className="min-h-screen bg-garden-background">
      <WebsiteOnboardingFlow onComplete={handleOnboardingComplete} />
    </div>
  );
};

export default OnboardingPage;
