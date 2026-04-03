import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { UrlInputStep } from './UrlInputStep';
import { DataReviewStep } from './DataReviewStep';
import { OnboardingSuccessIndicator } from './OnboardingSuccessIndicator';
import { WebsiteAnalysisLoader } from './WebsiteAnalysisLoader';
import { useWebsiteAnalysis } from '@/hooks/useWebsiteAnalysis';
import { useOnboardingCompletion } from './OnboardingCompletion';
import { useOnboardingStatus } from '@/contexts/OnboardingStatusContext';
import { LandingPageHeader } from '../landing/LandingPageHeader';

interface SimplifiedOnboardingFlowProps {
  onComplete: (data: any) => void;
}

// FIX: H5 - localStorage key for persisting onboarding progress across page refreshes
const PROGRESS_KEY_PREFIX = 'onboarding-progress:';

export const SimplifiedOnboardingFlow = ({ onComplete }: SimplifiedOnboardingFlowProps) => {
  const { user } = useAuth();

  // FIX: H5 - Restore progress from localStorage on mount
  const [currentStep, setCurrentStep] = useState(() => {
    if (!user?.id) return 1;
    try {
      const saved = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.currentStep || 1;
      }
    } catch { /* ignore */ }
    return 1;
  });
  const [websiteUrl, setWebsiteUrl] = useState(() => {
    if (!user?.id) return '';
    try {
      const saved = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.websiteUrl || '';
      }
    } catch { /* ignore */ }
    return '';
  });
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(true);

  const {
    isAnalyzing,
    analysisError,
    extractedData,
    analyzeWebsite,
    updateExtractedData,
    resetAnalysis
  } = useWebsiteAnalysis();

  const { completeOnboarding } = useOnboardingCompletion();
  const { markAsCompleted } = useOnboardingStatus();

  // FIX: H5 - Persist currentStep and websiteUrl to localStorage on change
  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(`${PROGRESS_KEY_PREFIX}${user.id}`, JSON.stringify({
      currentStep,
      websiteUrl,
    }));
  }, [currentStep, websiteUrl, user?.id]);

  // No navigation logic here - OnboardingPage handles all navigation

  const handleAnalyze = async () => {
    // Advance to step 2 immediately when analyze is clicked
    setCurrentStep(2);
    // Start analysis in the background with userId for location persistence
    await analyzeWebsite(websiteUrl, user?.id);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      resetAnalysis();
      setCurrentStep(1);
      setIsLocationConfirmed(true); // Reset when going back
    }
  };

  const handleComplete = async () => {
    // FIX: H4 - Add isCompletingOnboarding to early return guard to prevent double-submit
    if (!extractedData || !websiteUrl || !user || !isLocationConfirmed || isCompletingOnboarding) return;
    
    try {
      setIsCompletingOnboarding(true);
      
      // SERVER-SIDE SAFETY CHECK: Re-verify location confirmation invariant
      const { enforceLocationConfirmation } = await import('@/lib/locationValidation');
      const validation = await enforceLocationConfirmation(user.id);
      
      if (!validation.success) {
        console.error('❌ Server-side location validation failed:', validation.error);
        toast.error(validation.error || 'Location confirmation required');
        setIsCompletingOnboarding(false);
        return;
      }
      
      // Prepare the data for the parent completion handler
      const finalData = {
        aboutBusiness: `${extractedData.businessName ? extractedData.businessName + '. ' : ''}${extractedData.aboutBusiness}${extractedData.location ? ' Located in ' + extractedData.location + '.' : ''}${extractedData.services ? ' Services: ' + extractedData.services : ''}`,
        toneSamples: extractedData.brandVoice,
        annualEvents: extractedData.annualEvents,
        websiteUrl: websiteUrl
      };
      
      // FIX: H5 - Clear persisted progress on completion
      if (user) {
        localStorage.removeItem(`${PROGRESS_KEY_PREFIX}${user.id}`);
        localStorage.removeItem(`onboarding-progress-${user.id}`);
      }
      
      // Call the parent completion handler - no navigation here
      onComplete(finalData);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setIsCompletingOnboarding(false);
    }
  };

  // No navigation handlers - OnboardingPage manages navigation

  return (
    <div className="min-h-screen bg-garden-background">
      <LandingPageHeader onLogin={() => {}} />
      
      {/* Success/Loading Overlay */}
      <OnboardingSuccessIndicator 
        isCompleting={isCompletingOnboarding}
        step="saving"
        onContinue={() => {}}
      />
      
      {/* Analysis Loading */}
      <WebsiteAnalysisLoader isAnalyzing={isAnalyzing} />
      
      <div className="min-h-screen flex flex-col items-center justify-center bg-garden-background p-4">
        {/* Simple step indicator */}
        <div className="text-center mb-8 w-full max-w-lg">
          <p className="text-sm text-muted-foreground">Step {currentStep} of 2</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-garden-green h-2 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${(currentStep / 2) * 100}%` }}
            />
          </div>
        </div>

        {/* Main content - Hide only when completing or analyzing on step 1 */}
        {!isCompletingOnboarding && !(isAnalyzing && currentStep === 1) && (
          <div className="w-full max-w-lg">
            {currentStep === 1 ? (
              <UrlInputStep
                websiteUrl={websiteUrl}
                setWebsiteUrl={setWebsiteUrl}
                onAnalyze={handleAnalyze}
                onManualEntry={() => {}}
                isAnalyzing={isAnalyzing}
                analysisError={analysisError}
                onResetAnalysis={resetAnalysis}
              />
            ) : (
              <DataReviewStep
                extractedData={extractedData}
                updateExtractedData={updateExtractedData}
                onBack={handleBack}
                onComplete={handleComplete}
                isCompleting={isCompletingOnboarding}
                isAnalyzing={isAnalyzing}
                onLocationConfirmationChange={setIsLocationConfirmed}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};