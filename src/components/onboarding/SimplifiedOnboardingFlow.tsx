import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

import { UrlInputStep } from "./UrlInputStep";
import { DataReviewStep } from "./DataReviewStep";
import type { ConfirmedLocation } from "./DataReviewStep";
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

const PROGRESS_KEY_PREFIX = "onboarding-progress:";

export const SimplifiedOnboardingFlow = ({
  onComplete,
}: SimplifiedOnboardingFlowProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
    // Stay on step 1 while analyzing. The hook surfaces analysisError into
    // UrlInputStep on failure; we only advance to step 2 on a real success.
    const ok = await analyzeWebsite(websiteUrl, user?.id);
    if (ok) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      resetAnalysis();
      setCurrentStep(1);
    }
  };

  const handleComplete = async (confirmedLocation: ConfirmedLocation) => {
    if (
      !extractedData ||
      !websiteUrl ||
      !user ||
      isCompletingOnboarding
    )
      return;

    try {
      setIsCompletingOnboarding(true);

      const clearProgress = () => {
        localStorage.removeItem(`${PROGRESS_KEY_PREFIX}${user.id}`);
        localStorage.removeItem(`onboarding-progress-${user.id}`);
      };

      await completeOnboarding(
        extractedData,
        websiteUrl,
        user.id,
        onComplete,
        markAsCompleted,
        clearProgress,
        confirmedLocation,
      );
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      setIsCompletingOnboarding(false);
    }
  };

  return (
    <AuthCard className="auth-onboarding-card">
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
            />
          )
        ) : null}
      </div>
    </AuthCard>
  );
};
