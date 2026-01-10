import React from 'react';
import { cn } from '@/lib/utils';
import { TourStep, useQuickTour } from '@/contexts/QuickTourContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const TOUR_STEPS: { step: TourStep; label: string }[] = [
  { step: 'dashboard', label: 'Dashboard Overview' },
  { step: 'pos', label: 'Connect POS' },
  { step: 'customers', label: 'Customer Management' },
  { step: 'composer', label: 'AI Composer' },
  { step: 'automation', label: 'Automation Builder' },
];

interface TourProgressDotsProps {
  currentStep: TourStep;
  completedSteps: TourStep[];
  onStepClick?: (step: TourStep) => void;
  className?: string;
}

export function TourProgressDots({ 
  currentStep, 
  completedSteps, 
  onStepClick,
  className 
}: TourProgressDotsProps) {
  const currentIndex = TOUR_STEPS.findIndex(s => s.step === currentStep);

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {TOUR_STEPS.map((item, index) => {
        const isCompleted = completedSteps.includes(item.step);
        const isCurrent = item.step === currentStep;
        const isClickable = onStepClick && (isCompleted || index <= currentIndex);

        return (
          <Tooltip key={item.step}>
            <TooltipTrigger asChild>
              <button
                onClick={() => isClickable && onStepClick?.(item.step)}
                disabled={!isClickable}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-300",
                  isCurrent && "w-6 bg-primary scale-110",
                  isCompleted && !isCurrent && "bg-primary/60",
                  !isCompleted && !isCurrent && "bg-muted",
                  isClickable && "cursor-pointer hover:scale-125",
                  !isClickable && "cursor-default"
                )}
                aria-label={`${item.label} - ${isCurrent ? 'Current' : isCompleted ? 'Completed' : 'Upcoming'}`}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{item.label}</p>
              <p className="text-muted-foreground">
                {isCurrent ? 'Current step' : isCompleted ? 'Completed' : `Step ${index + 1}`}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
