
import { useEffect } from "react";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";

interface OnboardingProgressManagerProps {
  websiteUrl: string;
  currentStep: number;
  extractedData: any;
  setWebsiteUrl: (url: string) => void;
  setCurrentStep: (step: number) => void;
  updateExtractedData: (field: string, value: string) => void;
}

export const OnboardingProgressManager = ({
  websiteUrl,
  currentStep,
  extractedData,
  setWebsiteUrl,
  setCurrentStep,
  updateExtractedData
}: OnboardingProgressManagerProps) => {
  const { saveProgress, restoreProgress } = useOnboardingProgress();

  // Load saved progress on component mount
  useEffect(() => {
    const restored = restoreProgress();
    if (restored) {
      setWebsiteUrl(restored.websiteUrl || "");
      setCurrentStep(restored.currentStep || 1);
      
      // If we have extracted data, restore it
      if (restored.extractedData && Object.keys(restored.extractedData).length > 0) {
        Object.keys(restored.extractedData).forEach(key => {
          if (restored.extractedData[key]) {
            updateExtractedData(key, restored.extractedData[key]);
          }
        });
      }
    }
  }, []);

  // Save progress whenever key data changes
  useEffect(() => {
    if (websiteUrl || currentStep > 1) {
      saveProgress({ websiteUrl, currentStep, extractedData });
    }
  }, [websiteUrl, currentStep, extractedData]);

  return null; // This is a logic-only component
};
