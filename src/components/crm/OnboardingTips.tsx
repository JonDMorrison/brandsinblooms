import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react';

interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  highlightSelector: string;
}

interface OnboardingTipsProps {
  steps: OnboardingStep[];
  onDismiss: () => void;
  className?: string;
}

export const OnboardingTips: React.FC<OnboardingTipsProps> = ({
  steps,
  onDismiss,
  className
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if tips were previously dismissed
    const wasDismissed = localStorage.getItem('crm-builder-tips-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('crm-builder-tips-dismissed', 'true');
    setDismissed(true);
    onDismiss();
  };

  const highlightElement = (selector: string) => {
    // Remove previous highlights
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
      el.classList.remove('onboarding-highlight');
    });

    // Add highlight to current element
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('onboarding-highlight');
    }
  };

  useEffect(() => {
    if (!dismissed && steps[currentStep]) {
      highlightElement(steps[currentStep].highlightSelector);
    }

    return () => {
      // Cleanup highlights
      document.querySelectorAll('.onboarding-highlight').forEach(el => {
        el.classList.remove('onboarding-highlight');
      });
    };
  }, [currentStep, dismissed, steps]);

  if (dismissed) {
    return null;
  }

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Add CSS for highlighting */}
      <style>{`
        .onboarding-highlight {
          position: relative;
          z-index: 1000;
        }
        .onboarding-highlight::after {
          content: '';
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border: 2px solid hsl(var(--primary));
          border-radius: 8px;
          background: hsla(var(--primary), 0.1);
          pointer-events: none;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      <Card className={`fixed bottom-6 right-6 w-80 shadow-lg border z-50 ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Getting Started</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {currentStep + 1} of {steps.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                  {currentStepData.step}
                </span>
                {currentStepData.title}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentStepData.description}
              </p>
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="gap-1"
              >
                <ChevronLeft className="w-3 h-3" />
                Previous
              </Button>
              
              {isLastStep ? (
                <Button
                  size="sm"
                  onClick={handleDismiss}
                  className="gap-1"
                >
                  <CheckCircle className="w-3 h-3" />
                  Got it!
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};