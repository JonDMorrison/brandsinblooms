
import { useState } from "react";
// Removed sonner import - using global toast replacement
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { WebsiteAnalysisLoader } from "./onboarding/WebsiteAnalysisLoader";
import { UrlInputStep } from "./onboarding/UrlInputStep";
import { DataReviewStep } from "./onboarding/DataReviewStep";
import { OnboardingFlow } from "./OnboardingFlow";
import { LandingPageHeader } from "./landing/LandingPageHeader";
import { OnboardingContentLoader } from "./onboarding/OnboardingContentLoader";
import { OnboardingProgressManager } from "./onboarding/OnboardingProgressManager";
import { useWebsiteAnalysis } from "@/hooks/useWebsiteAnalysis";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useOnboardingCompletion } from "./onboarding/OnboardingCompletion";

interface WebsiteOnboardingFlowProps {
  onComplete: (data: any) => void;
}

export const WebsiteOnboardingFlow = ({ onComplete }: WebsiteOnboardingFlowProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [useManualEntry, setUseManualEntry] = useState(false);
  
  const { 
    isAnalyzing, 
    analysisError, 
    extractedData, 
    analyzeWebsite, 
    updateExtractedData, 
    resetAnalysis 
  } = useWebsiteAnalysis();
  
  const { markAsCompleted } = useOnboardingStatus();
  const { saveProgress, clearProgress } = useOnboardingProgress();
  const { completeOnboarding } = useOnboardingCompletion();

  const steps = [
    {
      title: "Enter Your Website",
      description: "We'll analyze your website to automatically fill in your business details, brand voice, and annual events.",
      component: "url-input"
    },
    {
      title: "Review & Edit Your Details",
      description: "We've extracted information from your website. You can change it at any time.",
      component: "review-data"
    }
  ];

  const handleAnalyze = async () => {
    // Clear any stuck progress from previous failed attempts
    if (analysisError) {
      clearProgress();
    }
    
    // Advance to step 2 immediately when analyze is clicked
    if (websiteUrl.trim()) {
      setCurrentStep(2);
      saveProgress({ websiteUrl, currentStep: 2, extractedData: {} });
    }
    
    // Start analysis in the background
    await analyzeWebsite(websiteUrl);
    // User stays on review screen regardless of analysis success/failure
  };

  const handleManualEntry = () => {
    setUseManualEntry(true);
    // Clear any saved progress since we're switching to manual entry
    clearProgress();
  };

  const handleNext = async () => {
    if (!user) {
      toast.error("Please log in to continue");
      return;
    }

    setIsCompleting(true);
    
    try {
      await completeOnboarding(
        extractedData,
        websiteUrl,
        user.id,
        onComplete,
        markAsCompleted,
        clearProgress
      );
    } catch (error) {
      // Error handling is done in the completion function
      console.error('Onboarding completion error:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleBack = () => {
    // Reset analysis state when going back
    resetAnalysis();
    setCurrentStep(1);
  };

  const handleManualEntryBack = () => {
    setUseManualEntry(false);
    // Clear any analysis errors when returning
    resetAnalysis();
  };

  const handleResetAnalysis = () => {
    resetAnalysis();
    // Clear stuck progress
    clearProgress();
  };

  // Update website URL and save progress (but not for failed attempts)
  const handleWebsiteUrlChange = (url: string) => {
    setWebsiteUrl(url);
    // Only save progress for valid URLs, not during error states
    if (user && url.trim() && !analysisError) {
      saveProgress({ websiteUrl: url, currentStep, extractedData });
    }
  };

  // If user chose manual entry, show the original onboarding flow
  if (useManualEntry) {
    return (
      <div className="min-h-screen bg-garden-background">
        <LandingPageHeader onLogin={() => navigate('/auth')} />
        <OnboardingFlow onComplete={onComplete} onBack={handleManualEntryBack} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-background">
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      
      {/* Progress Manager - handles localStorage persistence */}
      <OnboardingProgressManager
        websiteUrl={websiteUrl}
        currentStep={currentStep}
        extractedData={extractedData}
        setWebsiteUrl={setWebsiteUrl}
        setCurrentStep={setCurrentStep}
        updateExtractedData={updateExtractedData}
      />
      
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-lg">
          {/* Simple step indicator */}
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">Step {currentStep} of {steps.length}</p>
          </div>

          {/* Loading state - Show when analyzing or completing */}
          <WebsiteAnalysisLoader isAnalyzing={isAnalyzing} />
          <OnboardingContentLoader isCompleting={isCompleting} />

          {/* Main form - Hide only when completing or analyzing on step 1 */}
          {!isCompleting && !(isAnalyzing && currentStep === 1) && (
            <>
              {currentStep === 1 ? (
                <UrlInputStep
                  websiteUrl={websiteUrl}
                  setWebsiteUrl={handleWebsiteUrlChange}
                  onAnalyze={handleAnalyze}
                  onManualEntry={handleManualEntry}
                  isAnalyzing={isAnalyzing}
                  analysisError={analysisError}
                  onResetAnalysis={handleResetAnalysis}
                />
              ) : (
                <DataReviewStep
                  extractedData={extractedData}
                  updateExtractedData={updateExtractedData}
                  onBack={handleBack}
                  onComplete={handleNext}
                  isCompleting={isCompleting}
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
