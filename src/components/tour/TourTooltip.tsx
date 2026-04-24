import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, ArrowLeft, SkipForward, Play, Eye } from 'lucide-react';
import { Button } from '@/components/ui-legacy/button';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { useQuickTour, TourStep } from '@/contexts/QuickTourContext';
import { lockBodySiblings, unlockBodySiblings } from '@/utils/focusLock';
import Lottie from 'lottie-react';
import { TourProgressDots } from './TourProgressDots';
import { motion, AnimatePresence } from 'framer-motion';

interface TourTooltipProps {
  targetSelector: string;
  step: TourStep;
  title: string;
  description: string;
  highlight?: string;
  cta?: string;
  onCta?: () => void;
  animation?: any;
  mediaUrl?: string; // Video or GIF URL
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  requireAction?: boolean; // If true, user must click target to proceed
  onActionComplete?: () => void; // Called when required action is done
  showMeHowLink?: string; // Route to show for "Show me how" in setup
}

const TOUR_STEPS: TourStep[] = ['dashboard', 'pos', 'customers', 'composer', 'automation'];

export function TourTooltip({
  targetSelector,
  step,
  title,
  description,
  highlight,
  cta,
  onCta,
  animation,
  mediaUrl,
  side = 'bottom',
  align = 'center',
  requireAction = false,
  onActionComplete,
}: TourTooltipProps) {
  const {
    tourProgress,
    nextStep,
    previousStep,
    skipTour,
    goToStep,
  } = useQuickTour();
  
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [actionCompleted, setActionCompleted] = useState(false);
  const isVisible = tourProgress.isActive && tourProgress.currentStep === step;
  const targetElement = document.querySelector(targetSelector);
  
  const currentStepIndex = TOUR_STEPS.indexOf(step);
  const totalSteps = TOUR_STEPS.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Scroll to target element when step becomes visible
  useEffect(() => {
    if (isVisible && targetElement) {
      targetElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
    }
  }, [isVisible, targetElement]);

  // Listen for clicks on target element when requireAction is true
  useEffect(() => {
    if (!isVisible || !requireAction || !targetElement) return;

    const handleTargetClick = () => {
      setActionCompleted(true);
      onActionComplete?.();
    };

    targetElement.addEventListener('click', handleTargetClick);
    return () => {
      targetElement.removeEventListener('click', handleTargetClick);
    };
  }, [isVisible, requireAction, targetElement, onActionComplete]);

  // Reset action completed when step changes
  useEffect(() => {
    setActionCompleted(false);
  }, [step]);

  // Focus management and accessibility
  useEffect(() => {
    if (isVisible) {
      lockBodySiblings();
      
      const focusTooltip = () => {
        if (tooltipRef.current) {
          tooltipRef.current.focus();
        }
      };
      
      setTimeout(focusTooltip, 100);
      
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          skipTour();
        }
      };
      
      // Keyboard navigation
      const handleKeyNav = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' && !isLastStep && (!requireAction || actionCompleted)) {
          nextStep();
        } else if (e.key === 'ArrowLeft' && !isFirstStep) {
          previousStep();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleKeyNav);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('keydown', handleKeyNav);
        unlockBodySiblings();
      };
    }
  }, [isVisible, skipTour, nextStep, previousStep, isFirstStep, isLastStep, requireAction, actionCompleted]);

  if (!isVisible || !targetElement) {
    return null;
  }

  const handleCta = () => {
    if (onCta) {
      onCta();
    } else {
      nextStep();
    }
  };

  const canProceed = !requireAction || actionCompleted;
  const targetRect = targetElement.getBoundingClientRect();

  return (
    <>
      {/* Spotlight overlay */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] pointer-events-none"
            style={{
              background: `radial-gradient(
                ellipse ${Math.max(targetRect.width + 40, 120)}px ${Math.max(targetRect.height + 40, 80)}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px,
                transparent 0%,
                transparent 60%,
                rgba(0, 0, 0, 0.6) 100%
              )`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Target highlight pulse */}
      <AnimatePresence>
        {isVisible && requireAction && !actionCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0.5, 1, 0.5], 
              scale: [1, 1.05, 1] 
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              repeat: Infinity, 
              duration: 2,
              ease: 'easeInOut'
            }}
            className="fixed z-[999998] pointer-events-none rounded-lg border-2 border-primary"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
          />
        )}
      </AnimatePresence>

      <Popover.Root open={isVisible}>
        <Popover.Anchor asChild>
          <div 
            style={{
              position: 'fixed',
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              pointerEvents: 'none',
              zIndex: 1000000,
            }}
          />
        </Popover.Anchor>
        
        <Popover.Portal container={document.body}>
          <div data-overlay-root data-radix-popper-portalled>
            <Popover.Content
              ref={tooltipRef}
              side={side}
              align={align}
              sideOffset={12}
              className={cn(
                "z-[1000001] w-80 max-w-sm rounded-xl border bg-background p-4 shadow-2xl outline-none",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
                "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
              )}
              tabIndex={-1}
              role="dialog"
              aria-labelledby="tour-title"
              aria-describedby="tour-description"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {animation && (
                    <div className="w-10 h-10 flex-shrink-0 bg-primary/10 rounded-lg p-1">
                      <Lottie 
                        animationData={animation} 
                        loop={true}
                        autoplay={true}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                  )}
                  <div>
                    <h3 id="tour-title" className="font-semibold text-foreground">
                      {title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Step {currentStepIndex + 1} of {totalSteps}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipTour}
                  className="h-7 w-7 p-0 hover:bg-muted rounded-full"
                  aria-label="Skip tour"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress dots */}
              <TourProgressDots
                currentStep={step}
                completedSteps={tourProgress.completedSteps}
                onStepClick={goToStep}
                className="mb-4"
              />

              {/* Media (video/gif) */}
              {mediaUrl && (
                <div className="mb-4 rounded-lg overflow-hidden bg-muted">
                  <video
                    src={mediaUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto"
                  />
                </div>
              )}

              {/* Content */}
              <div className="mb-4">
                <p id="tour-description" className="text-sm text-foreground mb-2">
                  {description}
                </p>
                {highlight && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 mt-2">
                    💡 {highlight}
                  </p>
                )}
                {requireAction && !actionCompleted && (
                  <div className="flex items-center gap-2 text-xs text-primary mt-2 bg-primary/10 rounded-lg p-2">
                    <Eye className="h-3 w-3" />
                    <span>Click the highlighted element to continue</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  {!isFirstStep && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={previousStep}
                      className="text-xs h-8"
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Back
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipTour}
                    className="text-xs text-muted-foreground h-8"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    Skip
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={handleCta}
                  disabled={!canProceed && !onCta}
                  className={cn(
                    "text-xs h-8",
                    !canProceed && !onCta && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {cta || (isLastStep ? 'Finish' : 'Next')}
                  {!cta && <ArrowRight className="h-3 w-3 ml-1" />}
                </Button>
              </div>
            </Popover.Content>
          </div>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
