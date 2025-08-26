import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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

export const SimplifiedOnboardingFlow = ({ onComplete }: SimplifiedOnboardingFlowProps) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  
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

  // Prevent any redirects while completing onboarding
  useEffect(() => {
    if (isCompletingOnboarding) {
      // Store completion state in sessionStorage to survive any redirects
      sessionStorage.setItem('onboarding-completing', 'true');
    } else {
      sessionStorage.removeItem('onboarding-completing');
    }
  }, [isCompletingOnboarding]);

  // No navigation logic here - OnboardingPage handles all navigation

  const handleAnalyze = async () => {
    // Advance to step 2 immediately when analyze is clicked
    setCurrentStep(2);
    // Start analysis in the background
    await analyzeWebsite(websiteUrl);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      resetAnalysis();
      setCurrentStep(1);
    }
  };

  const handleComplete = async () => {
    if (!extractedData || !websiteUrl || !user) return;
    
    try {
      setIsCompletingOnboarding(true);
      
      // Prepare the data for the parent completion handler
      const finalData = {
        aboutBusiness: `${extractedData.businessName ? extractedData.businessName + '. ' : ''}${extractedData.aboutBusiness}${extractedData.location ? ' Located in ' + extractedData.location + '.' : ''}${extractedData.services ? ' Services: ' + extractedData.services : ''}`,
        toneSamples: extractedData.brandVoice,
        annualEvents: extractedData.annualEvents,
        websiteUrl: websiteUrl
      };
      
      // Clear progress
      if (user) {
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
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};