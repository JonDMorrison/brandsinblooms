
import * as React from "react";
import { cn } from "@/lib/utils";

interface CelebrationEffectProps {
  isVisible: boolean;
  onComplete?: () => void;
  className?: string;
}

export const CelebrationEffect = ({ 
  isVisible, 
  onComplete,
  className 
}: CelebrationEffectProps) => {
  React.useEffect(() => {
    if (isVisible && onComplete) {
      const timer = setTimeout(onComplete, 600);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className={cn('celebration-burst', className)}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎉</span>
        <span className="apple-headline-medium text-garden-green">
          Content Generated!
        </span>
        <span className="text-2xl">🌱</span>
      </div>
    </div>
  );
};

export const CompletionCelebration = ({ className }: { className?: string }) => {
  return (
    <div className={cn(
      'text-center py-8 apple-success-glow rounded-lg',
      'celebration-burst',
      className
    )}>
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-3xl animate-bounce">🌱</span>
        <span className="apple-headline-medium text-garden-green">
          You're all caught up!
        </span>
        <span className="text-3xl animate-bounce" style={{ animationDelay: '0.1s' }}>✨</span>
      </div>
      <p className="apple-body-enhanced text-gray-600">
        Your garden center marketing is blooming beautifully
      </p>
    </div>
  );
};
