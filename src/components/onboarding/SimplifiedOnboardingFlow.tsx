import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

import { UrlInputStep } from "./UrlInputStep";
import { DataReviewStep } from "./DataReviewStep";
import { OnboardingSuccessIndicator } from "./OnboardingSuccessIndicator";
import { WebsiteAnalysisLoader } from "./WebsiteAnalysisLoader";
import { useWebsiteAnalysis } from "@/hooks/useWebsiteAnalysis";
import { useOnboardingCompletion } from "./OnboardingCompletion";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useNavigate } from "react-router-dom";
import { AuthCard, AuthStepProgress } from "@/components/auth";

interface SimplifiedOnboardingFlowProps {
  onComplete: (data: unknown) => void;
}

// FIX: H5 - localStorage key for persisting onboarding progress across page refreshes
const PROGRESS_KEY_PREFIX = "onboarding-progress:";

export const SimplifiedOnboardingFlow = ({
  onComplete,
}: SimplifiedOnboardingFlowProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // FIX: H5 - Restore progress from localStorage on mount
  const [currentStep, setCurrentStep] = useState(() => {
    if (!user?.id) return 1;
    try {
      const saved = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.currentStep || 1;
      }
    } catch {
      /* ignore */
    }
    return 1;
  });
  const [websiteUrl, setWebsiteUrl] = useState(() => {
    if (!user?.id) return "";
    try {
      const saved = localStorage.getItem(`${PROGRESS_KEY_PREFIX}${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.websiteUrl || "";
      }
    } catch {
      /* ignore */
    }
    return "";
  });
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(true);

  const {
    isAnalyzing,
    analysisError,
    extractedData,
    analyzeWebsite,
    updateExtractedData,
    resetAnalysis,
  } = useWebsiteAnalysis();

  const { completeOnboarding } = useOnboardingCompletion();
  const { markAsCompleted } = useOnboardingStatus();

  // FIX: H5 - Persist currentStep and websiteUrl to localStorage on change
  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(
      `${PROGRESS_KEY_PREFIX}${user.id}`,
      JSON.stringify({
        currentStep,
        websiteUrl,
      }),
    );
  }, [currentStep, websiteUrl, user?.id]);

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
    if (
      !extractedData ||
      !websiteUrl ||
      !user ||
      !isLocationConfirmed ||
      isCompletingOnboarding
    )
      return;

    try {
      setIsCompletingOnboarding(true);

      const clearProgress = () => {
        localStorage.removeItem(`${PROGRESS_KEY_PREFIX}${user.id}`);
        localStorage.removeItem(`onboarding-progress-${user.id}`);
      };

      // Call the full completion pipeline:
      // 1. markAsCompleted() sets localStorage synchronously (prevents guard redirect)
      // 2. saveOnboardingResponse writes to DB
      // 3. createCompanyProfileFromOnboarding starts background content generation
      // 4. onComplete notifies the parent to advance to the "generating" step
      await completeOnboarding(
        extractedData,
        websiteUrl,
        user.id,
        onComplete,
        markAsCompleted,
        clearProgress,
      );
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      setIsCompletingOnboarding(false);
    }
  };

  return (
    <AuthCard className="auth-onboarding-card">
      {/* Success/Loading Overlay */}
      <OnboardingSuccessIndicator
        isCompleting={isCompletingOnboarding}
        step="saving"
        onContinue={() => {}}
      />

      <div className="auth-onboarding-flow">
        <AuthStepProgress
          steps={["Website URL", "Review & Confirm"]}
          currentStep={currentStep}
        />

        {isAnalyzing ? (
          <WebsiteAnalysisLoader isAnalyzing={isAnalyzing} />
        ) : !isCompletingOnboarding ? (
          currentStep === 1 ? (
            <UrlInputStep
              websiteUrl={websiteUrl}
              setWebsiteUrl={setWebsiteUrl}
              onAnalyze={handleAnalyze}
              onManualEntry={() => navigate("/onboarding/manual")}
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
          )
        ) : null}
      </div>
    </AuthCard>
  );
};
