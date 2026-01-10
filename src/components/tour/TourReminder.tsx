import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuickTour, TourStep } from '@/contexts/QuickTourContext';

const TOUR_STEPS: TourStep[] = ['dashboard', 'pos', 'customers', 'composer', 'automation'];
const REMINDER_STORAGE_KEY = 'tour-reminder-dismissed';
const REMINDER_EXPIRY_DAYS = 3;

export function TourReminder() {
  const { tourProgress, startTour } = useQuickTour();
  const [isVisible, setIsVisible] = useState(false);
  const [remainingSteps, setRemainingSteps] = useState(0);

  useEffect(() => {
    // Check if tour was started but not completed
    const wasStarted = tourProgress.completedSteps.length > 0;
    const wasCompleted = tourProgress.currentStep === 'completed';
    const wasSkipped = tourProgress.skipped;
    
    if (!wasStarted || wasCompleted || wasSkipped) {
      setIsVisible(false);
      return;
    }

    // Check if reminder was recently dismissed
    const dismissedAt = localStorage.getItem(REMINDER_STORAGE_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < REMINDER_EXPIRY_DAYS) {
        setIsVisible(false);
        return;
      }
    }

    // Calculate remaining steps
    const completedCount = tourProgress.completedSteps.length;
    const remaining = TOUR_STEPS.length - completedCount;
    
    if (remaining > 0 && !tourProgress.isActive) {
      setRemainingSteps(remaining);
      // Small delay before showing
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [tourProgress]);

  const handleContinue = () => {
    startTour();
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(REMINDER_STORAGE_KEY, new Date().toISOString());
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-full mx-4"
        >
          <div className="bg-background border border-primary/20 rounded-xl shadow-lg p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <PlayCircle className="w-5 h-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Continue your tour?
              </p>
              <p className="text-xs text-muted-foreground">
                {remainingSteps} step{remainingSteps !== 1 ? 's' : ''} remaining
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" onClick={handleContinue}>
                Continue
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
