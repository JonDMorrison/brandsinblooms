import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [completionStep, setCompletionStep] = useState<'saving' | 'generating' | 'finalizing' | 'complete'>('saving');
  
  const { 
    isAnalyzing, 
    analysisError, 
    extractedData, 
    analyzeWebsite, 
    updateExtractedData, 
    resetAnalysis 
  } = useWebsiteAnalysis();
  
  const { completeOnboarding } = useOnboardingCompletion();
  const { markAsCompleted, isCompleted: onboardingCompleted } = useOnboardingStatus();

  // Prevent any redirects while completing onboarding
  useEffect(() => {
    if (isCompletingOnboarding) {
      // Store completion state in sessionStorage to survive any redirects
      sessionStorage.setItem('onboarding-completing', 'true');
    } else {
      sessionStorage.removeItem('onboarding-completing');
    }
  }, [isCompletingOnboarding]);

  // Check if we're in the middle of completion (in case of redirect)
  useEffect(() => {
    const wasCompleting = sessionStorage.getItem('onboarding-completing') === 'true';
    
    // Only redirect if we were completing AND onboarding is actually completed now
    if (wasCompleting && !isCompletingOnboarding && onboardingCompleted) {
      console.log('🔄 SimplifiedOnboardingFlow: Detected completed onboarding, redirecting to dashboard...');
      // Clean up completion state
      sessionStorage.removeItem('onboarding-completing');
      navigate('/dashboard', { replace: true });
    } else if (wasCompleting && !isCompletingOnboarding && !onboardingCompleted) {
      // We were completing but onboarding isn't complete - clear the flag and stay here
      console.log('⚠️ SimplifiedOnboardingFlow: Was completing but onboarding not complete, clearing flag');
      sessionStorage.removeItem('onboarding-completing');
    }
  }, [navigate, isCompletingOnboarding, onboardingCompleted]);

  const handleAnalyze = async () => {
    const success = await analyzeWebsite(websiteUrl);
    if (success) {
      setTimeout(() => {
        setCurrentStep(2);
      }, 1000);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      resetAnalysis();
      setCurrentStep(1);
    }
  };

  const handleComplete = async () => {
    if (!user) {
      
      return;
    }

    try {
      setIsCompletingOnboarding(true);
      setCompletionStep('saving');
      
      // Enhanced completion with progress indicators
      await new Promise(resolve => setTimeout(resolve, 1000)); // Show saving step
      
      setCompletionStep('generating');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Show generating step
      
      setCompletionStep('finalizing');
      
      await completeOnboarding(
        extractedData,
        websiteUrl,
        user.id,
        onComplete,
        markAsCompleted,
        () => {} // No need to clear progress in simplified flow
      );
      
      setCompletionStep('complete');
      
    } catch (error) {
      console.error('Onboarding completion error:', error);
      setIsCompletingOnboarding(false);
      setCompletionStep('saving'); // Reset on error
    }
  };

  const handleContinueFromSuccess = () => {
    // Clean up completion state
    sessionStorage.removeItem('onboarding-completing');
    navigate('/dashboard', { replace: true });
  };

  const handleManualEntry = () => {
    // Switch to manual entry (original OnboardingFlow)
    navigate('/onboarding/manual');
  };

  return (
    <div className="min-h-screen bg-garden-background">
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      
      {/* Success/Loading Overlay */}
      <OnboardingSuccessIndicator 
        isCompleting={isCompletingOnboarding}
        step={completionStep}
        onContinue={handleContinueFromSuccess}
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

        {/* Main content - Hide when analyzing or completing */}
        {!isAnalyzing && !isCompletingOnboarding && (
          <div className="w-full max-w-lg">
            {currentStep === 1 ? (
              <UrlInputStep
                websiteUrl={websiteUrl}
                setWebsiteUrl={setWebsiteUrl}
                onAnalyze={handleAnalyze}
                onManualEntry={handleManualEntry}
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