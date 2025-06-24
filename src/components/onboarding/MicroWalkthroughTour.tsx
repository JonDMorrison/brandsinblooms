
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, X, Target } from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface MicroWalkthroughTourProps {
  isVisible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export const MicroWalkthroughTour: React.FC<MicroWalkthroughTourProps> = ({
  isVisible,
  onComplete,
  onSkip
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [highlightPosition, setHighlightPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const tourSteps: TourStep[] = [
    {
      id: 'ready-to-post',
      title: 'Ready to Post Queue',
      description: 'This is where you\'ll find your approved content ready to publish to Facebook and Instagram.',
      targetSelector: '[data-section="ready-to-post-section"]',
      position: 'bottom'
    },
    {
      id: 'weekly-content',
      title: 'Weekly Themes',
      description: 'Review and approve your AI-generated content here. Each week has a seasonal theme.',
      targetSelector: '[data-section="weekly-content-section"]',
      position: 'top'
    },
    {
      id: 'scheduler',
      title: 'Schedule Future Posts',
      description: 'Plan ahead by scheduling your content for optimal posting times.',
      targetSelector: '[data-calendar-section]',
      position: 'top'
    }
  ];

  // Update tooltip and highlight positions when step changes
  useEffect(() => {
    if (!isVisible || currentStep >= tourSteps.length) return;

    const updatePositions = () => {
      const step = tourSteps[currentStep];
      const targetElement = document.querySelector(step.targetSelector);
      
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Set highlight position
        setHighlightPosition({
          x: rect.left + scrollLeft - 8,
          y: rect.top + scrollTop - 8,
          width: rect.width + 16,
          height: rect.height + 16
        });

        // Calculate tooltip position based on step position preference
        let tooltipX = rect.left + scrollLeft;
        let tooltipY = rect.top + scrollTop;

        switch (step.position) {
          case 'top':
            tooltipX = rect.left + scrollLeft + rect.width / 2 - 150;
            tooltipY = rect.top + scrollTop - 120;
            break;
          case 'bottom':
            tooltipX = rect.left + scrollLeft + rect.width / 2 - 150;
            tooltipY = rect.bottom + scrollTop + 20;
            break;
          case 'left':
            tooltipX = rect.left + scrollLeft - 320;
            tooltipY = rect.top + scrollTop + rect.height / 2 - 60;
            break;
          case 'right':
            tooltipX = rect.right + scrollLeft + 20;
            tooltipY = rect.top + scrollTop + rect.height / 2 - 60;
            break;
        }

        // Ensure tooltip stays within viewport
        tooltipX = Math.max(20, Math.min(tooltipX, window.innerWidth - 320));
        tooltipY = Math.max(20, tooltipY);

        setTooltipPosition({ x: tooltipX, y: tooltipY });

        // Scroll target into view
        targetElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      }
    };

    // Delay to ensure DOM is ready
    setTimeout(updatePositions, 100);

    // Update on window resize
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions);

    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions);
    };
  }, [currentStep, isVisible]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  if (!isVisible || currentStep >= tourSteps.length) {
    return null;
  }

  const currentTourStep = tourSteps[currentStep];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" />
      
      {/* Highlight box */}
      <div
        className="fixed z-[9999] border-4 border-garden-green rounded-lg shadow-2xl pointer-events-none transition-all duration-300 ease-out"
        style={{
          left: `${highlightPosition.x}px`,
          top: `${highlightPosition.y}px`,
          width: `${highlightPosition.width}px`,
          height: `${highlightPosition.height}px`,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
        }}
      />

      {/* Tooltip */}
      <Card 
        className="fixed z-[10000] w-80 shadow-2xl border-2 border-garden-green"
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`
        }}
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-garden-green" />
            <h3 className="font-semibold text-lg text-gray-900">
              {currentTourStep.title}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-gray-700 mb-4">
            {currentTourStep.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Step {currentStep + 1} of {tourSteps.length}
              </span>
              <div className="flex gap-1">
                {tourSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentStep ? 'bg-garden-green' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                size="sm"
                className="bg-garden-green hover:bg-garden-green-dark"
              >
                {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                {currentStep < tourSteps.length - 1 && (
                  <ArrowRight className="w-4 h-4 ml-1" />
                )}
              </Button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700 text-xs"
            >
              Skip tour • Show me again later
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
