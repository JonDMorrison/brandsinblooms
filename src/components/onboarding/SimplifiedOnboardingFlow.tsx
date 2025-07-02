import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UrlInputStep } from './UrlInputStep';
import { DataReviewStep } from './DataReviewStep';
import { OnboardingSuccessIndicator } from './OnboardingSuccessIndicator';
import { WebsiteAnalysisLoader } from './WebsiteAnalysisLoader';
import { useWebsiteAnalysis } from '@/hooks/useWebsiteAnalysis';
import { useOnboardingCompletion } from './OnboardingCompletion';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { LandingPageHeader } from '../landing/LandingPageHeader';

interface SimplifiedOnboardingFlowProps {
  onComplete: (data: any) => void;
}

export const SimplifiedOnboardingFlow = ({ onComplete }: SimplifiedOnboardingFlowProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState('');
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
  const { markAsCompleted } = useOnboardingStatus();

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
      toast.error("Please log in to continue");
      return;
    }

    try {
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
      setCompletionStep('saving'); // Reset on error
    }
  };

  const handleContinueFromSuccess = () => {
    navigate('/', { replace: true });
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
        isCompleting={completionStep !== 'complete'}
        step={completionStep}
        onContinue={handleContinueFromSuccess}
      />
      
      {/* Analysis Loading */}
      <WebsiteAnalysisLoader isAnalyzing={isAnalyzing} />
      
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-lg">
          {/* Simple step indicator */}
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">Step {currentStep} of 2</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-garden-green h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${(currentStep / 2) * 100}%` }}
              />
            </div>
          </div>

          {/* Main content - Hide when analyzing or completing */}
          {!isAnalyzing && completionStep === 'saving' && (
            <>
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
                  isCompleting={completionStep !== 'saving'}
                  isAnalyzing={isAnalyzing}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};