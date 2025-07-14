
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
// Removed sonner import - using global toast replacement

const ONBOARDING_STORAGE_KEY = 'garden-center-onboarding-progress';

interface OnboardingProgressData {
  userId: string;
  websiteUrl: string;
  currentStep: number;
  extractedData: any;
  timestamp: number;
}

export const useOnboardingProgress = () => {
  const { user } = useAuth();

  // Save progress to localStorage
  const saveProgress = (data: Partial<OnboardingProgressData>) => {
    if (!user) return;
    
    const progressData = {
      userId: user.id,
      timestamp: Date.now(),
      ...data
    };
    
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progressData));
  };

  // Load progress from localStorage
  const loadProgress = (): OnboardingProgressData | null => {
    if (!user) return null;
    
    try {
      const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!saved) return null;
      
      const progressData = JSON.parse(saved);
      
      // Check if this is for the current user and not too old (24 hours)
      if (progressData.userId === user.id && 
          Date.now() - progressData.timestamp < 24 * 60 * 60 * 1000) {
        
        console.log('🔄 Restored onboarding progress:', progressData);
        return progressData;
      }
    } catch (error) {
      console.error('Error loading onboarding progress:', error);
    }
    
    return null;
  };

  // Clear progress from localStorage
  const clearProgress = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  };

  // Restore progress and show toast
  const restoreProgress = (): OnboardingProgressData | null => {
    if (!user) return null;
    
    const restored = loadProgress();
    if (restored) {
      toast.success("Restored your previous onboarding progress!");
    }
    return restored;
  };

  return {
    saveProgress,
    loadProgress,
    clearProgress,
    restoreProgress
  };
};
