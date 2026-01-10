import React, { useContext } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ChevronRight, SkipForward, Undo2, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickTourContext, TourStep } from '@/contexts/QuickTourContext';

interface SetupStepCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  helpText?: string;
  completed: boolean;
  skipped: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAction: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  actionLabel: string;
  children?: React.ReactNode;
  tourStep?: TourStep; // Optional: links to a tour step for "Show me how"
}

export const SetupStepCard: React.FC<SetupStepCardProps> = ({
  icon,
  title,
  description,
  helpText,
  completed,
  skipped,
  expanded,
  onToggle,
  onAction,
  onSkip,
  onUnskip,
  actionLabel,
  children,
  tourStep,
}) => {
  // Use context directly to avoid error when provider is not available
  const tourContext = useContext(QuickTourContext) as { startTourAtStep?: (step: TourStep) => void } | undefined;

  const handleShowMeHow = () => {
    if (tourStep && tourContext?.startTourAtStep) {
      tourContext.startTourAtStep(tourStep);
    }
  };
  
  const canShowTourLink = !!(tourStep && tourContext?.startTourAtStep);
  const getStatusBadge = () => {
    if (completed) {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Complete
        </Badge>
      );
    }
    if (skipped) {
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          <SkipForward className="w-3 h-3 mr-1" />
          Skipped
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-amber-300 text-amber-600 bg-amber-50">
        <Circle className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <Card
      className={cn(
        'transition-all duration-300 overflow-hidden',
        completed && 'border-primary/30 bg-primary/5',
        skipped && 'opacity-70',
        expanded && !completed && !skipped && 'ring-2 ring-primary/20'
      )}
    >
      <CardContent className="p-0">
        {/* Header - Always visible */}
        <button
          onClick={onToggle}
          className="w-full p-5 flex items-center gap-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div
            className={cn(
              'p-3 rounded-xl transition-colors',
              completed
                ? 'bg-primary text-primary-foreground'
                : skipped
                ? 'bg-muted text-muted-foreground'
                : 'bg-primary/10 text-primary'
            )}
          >
            {completed ? <CheckCircle2 className="w-6 h-6" /> : icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn(
                'font-semibold',
                completed && 'text-primary',
                skipped && 'text-muted-foreground'
              )}>
                {title}
              </h3>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
              {description}
            </p>
          </div>

          <ChevronRight
            className={cn(
              'w-5 h-5 text-muted-foreground transition-transform',
              expanded && 'rotate-90'
            )}
          />
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="px-5 pb-5 space-y-4 border-t">
            {helpText && (
              <div className="pt-4 text-sm text-muted-foreground bg-muted/30 -mx-5 px-5 py-3">
                💡 {helpText}
              </div>
            )}

            {children && <div className="pt-4">{children}</div>}

            <div className="flex items-center gap-3 pt-2">
              {!completed && !skipped && (
                <>
                  <Button onClick={onAction} className="flex-1">
                    {actionLabel}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
                    <SkipForward className="w-4 h-4 mr-1" />
                    Skip for now
                  </Button>
                  {canShowTourLink && (
                    <Button variant="link" onClick={handleShowMeHow} className="text-primary text-sm">
                      <PlayCircle className="w-4 h-4 mr-1" />
                      Show me how
                    </Button>
                  )}
                </>
              )}
              
              {completed && (
                <Button variant="outline" onClick={onAction}>
                  Review Settings
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}

              {skipped && (
                <Button variant="outline" onClick={onUnskip}>
                  <Undo2 className="w-4 h-4 mr-1" />
                  I want to do this
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
