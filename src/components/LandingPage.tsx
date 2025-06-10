
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
    if (user) {
      // User is already authenticated, redirect to dashboard
      navigate('/app');
    } else if (onGetStarted) {
      // Use the provided onGetStarted callback if user is not authenticated
      onGetStarted();
    } else {
      // User is not authenticated, redirect to auth page
      navigate('/auth');
    }
  };

  const handleSeePricing = () => {
    if (user) {
      // If user is authenticated, redirect to dashboard instead of pricing
      navigate('/app');
    } else {
      navigate('/pricing');
    }
  };

  const handleLogin = () => {
    if (user) {
      // If user is already authenticated, redirect to dashboard
      navigate('/app');
    } else {
      navigate('/auth');
    }
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
