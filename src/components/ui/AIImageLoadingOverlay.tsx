import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface AIImageLoadingOverlayProps {
  className?: string;
  message?: string;
  showIcon?: boolean;
}

export const AIImageLoadingOverlay: React.FC<AIImageLoadingOverlayProps> = ({ 
  className, 
  message = "Generating image with AI...",
  showIcon = true
}) => {
  return (
    <div className={cn(
      "absolute inset-0 bg-background/95 backdrop-blur-sm",
      "flex flex-col items-center justify-center z-20",
      "rounded-lg",
      className
    )}>
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" color="primary" />
        
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {message}
          </p>
          <p className="text-xs text-muted-foreground">
            May take 8-10 seconds
          </p>
        </div>
      </div>
    </div>
  );
};
