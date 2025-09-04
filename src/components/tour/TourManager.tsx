import React, { useEffect } from 'react';
import { useQuickTour } from '@/contexts/QuickTourContext';
import { TourSteps } from './TourSteps';

export function TourManager() {
  const { shouldShowTour, isTourEligible, startTour, tourProgress } = useQuickTour();

  // Tour auto-start removed - now controlled manually via user actions

  if (!shouldShowTour) {
    return null;
  }

  return <TourSteps />;
}