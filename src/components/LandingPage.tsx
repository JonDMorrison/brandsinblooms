
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LandingPageHeader } from "./landing/LandingPageHeader";
import { HeroSection } from "./landing/HeroSection";
import { HowItWorksSection } from "./landing/HowItWorksSection";
import { BenefitsSection } from "./landing/BenefitsSection";
import { TestimonialsSection } from "./landing/TestimonialsSection";
import { PricingPreviewSection } from "./landing/PricingPreviewSection";
import { FinalCTASection } from "./landing/FinalCTASection";

interface LandingPageProps {
  onGetStarted?: () => void;
}

export const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (onGetStarted) {
      // Use the provided onGetStarted callback (for authenticated users in the app flow)
      onGetStarted();
    } else if (user) {
      // User is authenticated but no callback provided, navigate to app
      navigate('/app');
    } else {
      // User is not authenticated, redirect to auth page
      navigate('/auth');
    }
  };

  const handleSeePricing = () => {
    navigate('/pricing');
  };

  const handleLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-garden-background">
      <LandingPageHeader onLogin={handleLogin} />
      <HeroSection onGetStarted={handleGetStarted} />
      <HowItWorksSection />
      <BenefitsSection />
      <TestimonialsSection />
      <PricingPreviewSection onSeePricing={handleSeePricing} />
      <FinalCTASection onGetStarted={handleGetStarted} />
    </div>
  );
};
