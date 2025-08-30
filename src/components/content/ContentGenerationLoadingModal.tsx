import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Progress } from '@/components/ui/progress';
import { Sparkles, FileText, Users, Mail, Video } from 'lucide-react';

interface ContentGenerationLoadingModalProps {
  isOpen: boolean;
  campaignTitle: string;
  progress?: number;
  currentStep?: string;
}

const generationSteps = [
  { icon: Sparkles, label: 'Analyzing your campaign theme', delay: 0 },
  { icon: FileText, label: 'Crafting social media posts', delay: 2000 },
  { icon: Mail, label: 'Writing email content', delay: 4000 },
  { icon: Video, label: 'Creating video scripts', delay: 6000 },
  { icon: Users, label: 'Personalizing for your audience', delay: 8000 },
];

export const ContentGenerationLoadingModal: React.FC<ContentGenerationLoadingModalProps> = ({
  isOpen,
  campaignTitle,
  progress = 0,
  currentStep
}) => {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [displayedSteps, setDisplayedSteps] = React.useState<number[]>([0]);

  React.useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      setDisplayedSteps([0]);
      return;
    }

    const timers = generationSteps.map((step, index) => {
      return setTimeout(() => {
        setCurrentStepIndex(index);
        setDisplayedSteps(prev => [...prev, index].filter((v, i, a) => a.indexOf(v) === i));
      }, step.delay);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [isOpen]);

  const calculatedProgress = currentStep ? progress : Math.min(95, (currentStepIndex + 1) * 20);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              Generating Your Content
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Campaign Info */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Creating personalized content for
            </p>
            <p className="font-medium text-foreground">{campaignTitle}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={calculatedProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {calculatedProgress}% complete
            </p>
          </div>

          {/* Generation Steps */}
          <div className="space-y-3">
            {generationSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const isVisible = displayedSteps.includes(index);

              if (!isVisible) return null;

              return (
                <div 
                  key={index}
                  className={`flex items-center gap-3 transition-all duration-500 ${
                    isActive ? 'text-primary' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/50'
                  }`}
                >
                  <div className={`relative flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`}>
                    <StepIcon className="w-4 h-4" />
                    {isCompleted && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </div>
                  <span className="text-sm">{step.label}</span>
                  {isActive && (
                    <div className="ml-auto">
                      <LoadingSpinner size="sm" color="primary" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Message */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {currentStep || "This usually takes 30-60 seconds"}
            </p>
            <p className="text-xs text-muted-foreground">
              Creating 5+ personalized content pieces for your review
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};