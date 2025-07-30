
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPageHeader } from './LandingPageHeader';
import { HeroSection } from './HeroSection';
import { HowItWorksSection } from './HowItWorksSection';
import { BenefitsSection } from './BenefitsSection';
import { TestimonialsSection } from './TestimonialsSection';
import { PricingPreviewSection } from './PricingPreviewSection';
import { FinalCTASection } from './FinalCTASection';

export const CompleteLandingPage = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    console.log('Get Started button clicked - navigating to /auth');
    navigate('/auth');
  };

  const handleLogin = () => {
    navigate('/auth');
  };

  const handleSeePricing = () => {
    navigate('/pricing');
  };

  return (
    <div className="w-full min-h-screen bg-white">
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
