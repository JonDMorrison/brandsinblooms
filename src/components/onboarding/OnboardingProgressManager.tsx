
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingProgressManagerProps {
  websiteUrl: string;
  currentStep: number;
  extractedData: any;
  setWebsiteUrl: (url: string) => void;
  setCurrentStep: (step: number) => void;
  updateExtractedData: (field: string, value: string) => void;
}

interface SavedProgress {
  websiteUrl: string;
  currentStep: number;
  extractedData: any;
  timestamp?: number;
  analysisAttempts?: number;
}

export const OnboardingProgressManager = ({
  websiteUrl,
  currentStep,
  extractedData,
  setWebsiteUrl,
  setCurrentStep,
  updateExtractedData,
}: OnboardingProgressManagerProps) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const loadSavedProgress = () => {
      try {
        const savedProgressKey = `onboarding-progress-${user.id}`;
        const savedProgressStr = localStorage.getItem(savedProgressKey);
        
        if (savedProgressStr) {
          const savedProgress: SavedProgress = JSON.parse(savedProgressStr);
          const now = Date.now();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          // Check if progress is stale (older than 24 hours)
          if (savedProgress.timestamp && (now - savedProgress.timestamp) > maxAge) {
            console.log('🧹 OnboardingProgressManager: Clearing stale progress data');
            localStorage.removeItem(savedProgressKey);
            return;
          }
          
          // Check for stuck analysis attempts (more than 3 failed attempts)
          if (savedProgress.analysisAttempts && savedProgress.analysisAttempts > 3) {
            console.log('🧹 OnboardingProgressManager: Clearing progress with too many failed attempts');
            localStorage.removeItem(savedProgressKey);
            return;
          }
          
          console.log('📱 OnboardingProgressManager: Loading saved progress:', savedProgress);
          
          // Restore progress
          if (savedProgress.websiteUrl) {
            setWebsiteUrl(savedProgress.websiteUrl);
          }
          
          // Only restore step 2 if we have meaningful extracted data
          if (savedProgress.currentStep === 2 && savedProgress.extractedData) {
            const hasValidData = Object.values(savedProgress.extractedData).some(
              value => typeof value === 'string' && value.trim().length > 0
            );
            
            if (hasValidData) {
              setCurrentStep(savedProgress.currentStep);
              // Restore extracted data
              Object.entries(savedProgress.extractedData).forEach(([field, value]) => {
                if (typeof value === 'string' && value.trim()) {
                  updateExtractedData(field, value);
                }
              });
            } else {
              // If no valid data, reset to step 1
              console.log('🔄 OnboardingProgressManager: No valid extracted data, resetting to step 1');
              setCurrentStep(1);
            }
          }
        }
      } catch (error) {
        console.error('❌ OnboardingProgressManager: Error loading progress:', error);
        // Clear corrupted progress data
        const savedProgressKey = `onboarding-progress-${user.id}`;
        localStorage.removeItem(savedProgressKey);
      }
    };

    loadSavedProgress();
  }, [user]);

  // Save progress whenever it changes (but throttled)
  useEffect(() => {
    if (!user) return;

    const saveProgress = () => {
      try {
        const savedProgressKey = `onboarding-progress-${user.id}`;
        const currentProgress: SavedProgress = {
          websiteUrl,
          currentStep,
          extractedData,
          timestamp: Date.now(),
        };
        
        // Don't save if we're still on step 1 with no URL
        if (currentStep === 1 && !websiteUrl.trim()) {
          return;
        }
        
        localStorage.setItem(savedProgressKey, JSON.stringify(currentProgress));
        console.log('💾 OnboardingProgressManager: Progress saved');
      } catch (error) {
        console.error('❌ OnboardingProgressManager: Error saving progress:', error);
      }
    };

    // Throttle saves to avoid excessive localStorage writes
    const timeoutId = setTimeout(saveProgress, 500);
    return () => clearTimeout(timeoutId);
  }, [user, websiteUrl, currentStep, extractedData]);

  return null; // This component doesn't render anything
};
