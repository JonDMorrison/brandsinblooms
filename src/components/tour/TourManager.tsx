import React, { useEffect, useState } from 'react';
import { useQuickTour } from '@/contexts/QuickTourContext';
import { TourSteps } from './TourSteps';
import { TourWelcomeModal } from './TourWelcomeModal';
import { TourCelebration } from './TourCelebration';
import { TourReminder } from './TourReminder';

export function TourManager() {
  const { 
    shouldShowTour, 
    showWelcomeModal, 
    showCelebration,
    closeWelcomeModal,
    closeCelebration,
    openWelcomeModal,
  } = useQuickTour();

  // Check for sessionStorage flag to open welcome modal (from UserMenu)
  useEffect(() => {
    const shouldStart = sessionStorage.getItem('startProductTour');
    if (shouldStart === 'true') {
      sessionStorage.removeItem('startProductTour');
      openWelcomeModal();
    }
  }, [openWelcomeModal]);

  return (
    <>
      {/* Welcome modal for first-time users or manual trigger */}
      <TourWelcomeModal
        isOpen={showWelcomeModal}
        onClose={closeWelcomeModal}
      />

      {/* Tour steps */}
      {shouldShowTour && <TourSteps />}

      {/* Completion celebration */}
      <TourCelebration
        isVisible={showCelebration}
        onClose={closeCelebration}
      />

      {/* Reminder for incomplete tours */}
      <TourReminder />
    </>
  );
}
