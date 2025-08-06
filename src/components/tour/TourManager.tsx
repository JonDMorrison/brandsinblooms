import React, { useEffect } from 'react';
import { useQuickTour } from '@/contexts/QuickTourContext';
import { TourSteps } from './TourSteps';

export function TourManager() {
  const { shouldShowTour, isTourEligible, startTour, tourProgress } = useQuickTour();

  // Auto-start tour for eligible users
  useEffect(() => {
    if (isTourEligible && !tourProgress.isActive && !tourProgress.skipped && tourProgress.currentStep !== 'completed') {
      // Check if this is truly the first time (no progress at all)
      const isFirstTime = tourProgress.completedSteps.length === 0 && tourProgress.currentStep === 'dashboard';
      
      if (isFirstTime) {
        // Small delay to ensure page is loaded
        const timer = setTimeout(() => {
          startTour();
        }, 1500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isTourEligible, tourProgress, startTour]);

  if (!shouldShowTour) {
    return null;
  }

  return <TourSteps />;
}