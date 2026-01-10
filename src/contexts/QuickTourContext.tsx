import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type TourStep = 'dashboard' | 'pos' | 'customers' | 'composer' | 'automation' | 'completed';
export type TourPath = 'quick' | 'import' | 'campaign' | null;

interface TourProgress {
  currentStep: TourStep;
  isActive: boolean;
  completedSteps: TourStep[];
  skipped: boolean;
}

interface QuickTourContextType {
  tourProgress: TourProgress;
  tourPath: TourPath;
  showWelcomeModal: boolean;
  showCelebration: boolean;
  startTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  goToStep: (step: TourStep) => void;
  setTourPath: (path: TourPath) => void;
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;
  closeCelebration: () => void;
  startTourAtStep: (step: TourStep) => void;
  isTourEligible: boolean;
  shouldShowTour: boolean;
  markSetupStepFromTour: (stepId: string) => void;
}

const defaultProgress: TourProgress = {
  currentStep: 'dashboard',
  isActive: false,
  completedSteps: [],
  skipped: false,
};

const QuickTourContext = createContext<QuickTourContextType | undefined>(undefined);

const TOUR_STEPS: TourStep[] = ['dashboard', 'pos', 'customers', 'composer', 'automation'];

export function QuickTourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [localProgress, setLocalProgress] = useLocalStorage<TourProgress>('quick-tour-progress', defaultProgress);
  const [tourProgress, setTourProgress] = useState<TourProgress>(localProgress);
  const [isTourEligible, setIsTourEligible] = useState(false);
  const [betaTourEnabled, setBetaTourEnabled] = useState(false);
  const [tourPath, setTourPathState] = useState<TourPath>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [setupStepCallback, setSetupStepCallback] = useState<((stepId: string) => void) | null>(null);
  // Check if user is eligible for tour (beta opt-in and hasn't completed)
  useEffect(() => {
    const checkTourEligibility = async () => {
      if (!user) {
        setIsTourEligible(false);
        return;
      }

      try {
        // Check company profile for beta flag
        const { data: profile } = await supabase
          .from('company_profiles')
          .select('beta_tour_enabled, onboarding_completed_at')
          .eq('user_id', user.id)
          .single();

        const betaEnabled = profile?.beta_tour_enabled ?? true;
        setBetaTourEnabled(betaEnabled);

        // Check if tour was completed in database
        const { data: progress } = await supabase
          .from('tutorial_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('step', 'completed')
          .maybeSingle();

        const hasCompletedTour = !!progress || localProgress.skipped || localProgress.currentStep === 'completed';
        
        // Check URL params for manual replay
        const urlParams = new URLSearchParams(window.location.search);
        const replayTour = urlParams.has('replayTour');

        setIsTourEligible(betaEnabled && (!hasCompletedTour || replayTour));
      } catch (error) {
        console.error('Error checking tour eligibility:', error);
        setIsTourEligible(false);
      }
    };

    checkTourEligibility();
  }, [user, localProgress]);

  // Sync progress to database
  const syncProgressToDatabase = useCallback(async (step: TourStep) => {
    if (!user) return;

    try {
      await supabase
        .from('tutorial_progress')
        .upsert({
          user_id: user.id,
          step: step,
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,step'
        });
    } catch (error) {
      console.error('Error syncing tour progress:', error);
    }
  }, [user]);

  const updateProgress = useCallback((newProgress: Partial<TourProgress>) => {
    const updated = { ...tourProgress, ...newProgress };
    setTourProgress(updated);
    setLocalProgress(updated);
  }, [tourProgress, setLocalProgress]);

  const startTour = useCallback(() => {
    const newProgress = {
      currentStep: 'dashboard' as TourStep,
      isActive: true,
      completedSteps: [],
      skipped: false,
    };
    updateProgress(newProgress);
    syncProgressToDatabase('dashboard');
  }, [updateProgress, syncProgressToDatabase]);

  const nextStep = useCallback(() => {
    if (!tourProgress.isActive) return;
    
    const currentIndex = TOUR_STEPS.indexOf(tourProgress.currentStep);
    const nextIndex = currentIndex + 1;
    
    // Mark current step as completed
    const completedSteps = [...tourProgress.completedSteps];
    if (!completedSteps.includes(tourProgress.currentStep)) {
      completedSteps.push(tourProgress.currentStep);
    }

    if (nextIndex >= TOUR_STEPS.length) {
      // Tour completed
      updateProgress({
        currentStep: 'completed',
        isActive: false,
        completedSteps,
      });
      syncProgressToDatabase('completed');
    } else {
      const nextStep = TOUR_STEPS[nextIndex];
      updateProgress({
        currentStep: nextStep,
        completedSteps,
      });
      syncProgressToDatabase(nextStep);
    }
  }, [tourProgress, updateProgress, syncProgressToDatabase]);

  const previousStep = useCallback(() => {
    if (!tourProgress.isActive) return;
    
    const currentIndex = TOUR_STEPS.indexOf(tourProgress.currentStep);
    const prevIndex = currentIndex - 1;
    
    if (prevIndex >= 0) {
      const prevStep = TOUR_STEPS[prevIndex];
      updateProgress({
        currentStep: prevStep,
      });
    }
  }, [tourProgress, updateProgress]);

  const skipTour = useCallback(() => {
    updateProgress({
      isActive: false,
      skipped: true,
      currentStep: 'completed',
    });
    syncProgressToDatabase('completed');
  }, [updateProgress, syncProgressToDatabase]);

  const completeTour = useCallback(() => {
    updateProgress({
      isActive: false,
      currentStep: 'completed',
      completedSteps: TOUR_STEPS,
    });
    syncProgressToDatabase('completed');
    setShowCelebration(true);
  }, [updateProgress, syncProgressToDatabase]);

  const goToStep = useCallback((step: TourStep) => {
    if (!tourProgress.isActive) return;
    updateProgress({ currentStep: step });
    syncProgressToDatabase(step);
  }, [tourProgress.isActive, updateProgress, syncProgressToDatabase]);

  const setTourPath = useCallback((path: TourPath) => {
    setTourPathState(path);
  }, []);

  const openWelcomeModal = useCallback(() => {
    setShowWelcomeModal(true);
  }, []);

  const closeWelcomeModal = useCallback(() => {
    setShowWelcomeModal(false);
    localStorage.setItem('tour-welcome-shown', 'true');
  }, []);

  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  const startTourAtStep = useCallback((step: TourStep) => {
    const stepIndex = TOUR_STEPS.indexOf(step);
    const completedSteps = TOUR_STEPS.slice(0, stepIndex);
    updateProgress({
      currentStep: step,
      isActive: true,
      completedSteps,
      skipped: false,
    });
    syncProgressToDatabase(step);
  }, [updateProgress, syncProgressToDatabase]);

  // Function to mark setup steps complete from tour actions
  const markSetupStepFromTour = useCallback((stepId: string) => {
    // This will be called when tour CTA actions complete setup steps
    // The actual marking is handled by the component that receives this callback
    console.log('Tour completed setup step:', stepId);
  }, []);

  const shouldShowTour = isTourEligible && betaTourEnabled && !tourProgress.skipped && tourProgress.currentStep !== 'completed';

  return (
    <QuickTourContext.Provider value={{
      tourProgress,
      tourPath,
      showWelcomeModal,
      showCelebration,
      startTour,
      nextStep,
      previousStep,
      skipTour,
      completeTour,
      goToStep,
      setTourPath,
      openWelcomeModal,
      closeWelcomeModal,
      closeCelebration,
      startTourAtStep,
      isTourEligible,
      shouldShowTour,
      markSetupStepFromTour,
    }}>
      {children}
    </QuickTourContext.Provider>
  );
}

export function useQuickTour() {
  const context = useContext(QuickTourContext);
  if (context === undefined) {
    throw new Error('useQuickTour must be used within a QuickTourProvider');
  }
  return context;
}