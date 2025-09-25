
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPageHeader } from './LandingPageHeader';
import { HeroSection } from './HeroSection';
import { ProblemAgitationSection } from './ProblemAgitationSection';
import { GuideSection } from './GuideSection';

import { BenefitsSection } from './BenefitsSection';
import { DifferentiatorsSection } from './DifferentiatorsSection';

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
    <div className="w-full min-h-screen theme-core-home bg-offwhite">
      <LandingPageHeader onLogin={handleLogin} />
      <HeroSection onGetStarted={handleGetStarted} />
      <ProblemAgitationSection />
      <GuideSection />
      
      <BenefitsSection />
      <DifferentiatorsSection onTalkToTeam={handleGetStarted} />
      
      <PricingPreviewSection onSeePricing={handleSeePricing} />
      <FinalCTASection onGetStarted={handleGetStarted} />
    </div>
  );
};
