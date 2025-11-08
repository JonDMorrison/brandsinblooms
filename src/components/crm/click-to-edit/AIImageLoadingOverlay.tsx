import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface AIImageLoadingOverlayProps {
  message?: string;
  showIcon?: boolean;
  className?: string;
}

export const AIImageLoadingOverlay: React.FC<AIImageLoadingOverlayProps> = ({
  message = 'Generating image with AI...',
  showIcon = true,
  className
}) => {
  return (
    <div className={cn(
      "absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm z-10 rounded-lg",
      className
    )}>
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" color="primary" />
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">{message}</p>
          <p className="text-xs text-muted-foreground">May take 8-10 seconds</p>
        </div>
      </div>
    </div>
  );
};
