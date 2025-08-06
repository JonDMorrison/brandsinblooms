import React, { useEffect, useRef } from 'react';
import { X, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { useQuickTour, TourStep } from '@/contexts/QuickTourContext';
import { lockBodySiblings, unlockBodySiblings } from '@/utils/focusLock';
import Lottie from 'lottie-react';

interface TourTooltipProps {
  targetSelector: string;
  step: TourStep;
  title: string;
  description: string;
  highlight?: string;
  cta?: string;
  onCta?: () => void;
  animation?: any;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
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
  side = 'bottom',
  align = 'center',
}: TourTooltipProps) {
  const {
    tourProgress,
    nextStep,
    previousStep,
    skipTour,
  } = useQuickTour();
  
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isVisible = tourProgress.isActive && tourProgress.currentStep === step;
  const targetElement = document.querySelector(targetSelector);
  
  const currentStepIndex = TOUR_STEPS.indexOf(step);
  const totalSteps = TOUR_STEPS.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Focus management and accessibility
  useEffect(() => {
    if (isVisible) {
      lockBodySiblings();
      
      // Focus the tooltip when it becomes visible
      const focusTooltip = () => {
        if (tooltipRef.current) {
          tooltipRef.current.focus();
        }
      };
      
      // Small delay to ensure DOM is ready
      setTimeout(focusTooltip, 100);
      
      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          skipTour();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        unlockBodySiblings();
      };
    }
  }, [isVisible, skipTour]);

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

  return (
    <Popover.Root open={isVisible}>
      <Popover.Anchor asChild>
        <div 
          style={{
            position: 'absolute',
            top: targetElement.getBoundingClientRect().top + window.scrollY,
            left: targetElement.getBoundingClientRect().left + window.scrollX,
            width: targetElement.getBoundingClientRect().width,
            height: targetElement.getBoundingClientRect().height,
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
            sideOffset={8}
            className={cn(
              "z-[1000001] w-80 max-w-sm rounded-lg border bg-background p-4 shadow-lg outline-none",
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
              <div className="flex items-center gap-2">
                {animation && (
                  <div className="w-8 h-8 flex-shrink-0">
                    <Lottie 
                      animationData={animation} 
                      loop={true}
                      autoplay={true}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                )}
                <div>
                  <h3 id="tour-title" className="font-semibold text-sm text-foreground">
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
                className="h-6 w-6 p-0 hover:bg-muted"
                aria-label="Skip tour"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      index <= currentStepIndex ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <p id="tour-description" className="text-sm text-foreground mb-2">
                {description}
              </p>
              {highlight && (
                <p className="text-xs text-muted-foreground italic">
                  💡 {highlight}
                </p>
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
                    className="text-xs"
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Previous
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipTour}
                  className="text-xs text-muted-foreground"
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  Skip Tour
                </Button>
              </div>

              <Button
                size="sm"
                onClick={handleCta}
                className="text-xs"
              >
                {cta || (isLastStep ? 'Finish' : 'Next')}
                {!cta && <ArrowRight className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </Popover.Content>
        </div>
      </Popover.Portal>
    </Popover.Root>
  );
}