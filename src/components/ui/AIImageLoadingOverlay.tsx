import React from 'react';
import { cn } from '@/lib/utils';

interface AIImageLoadingOverlayProps {
  className?: string;
  message?: string;
}

export const AIImageLoadingOverlay: React.FC<AIImageLoadingOverlayProps> = ({ 
  className, 
  message = "Generating Images"
}) => {
  return (
    <div className={cn(
      "absolute inset-0 bg-background/95 backdrop-blur-sm",
      "flex flex-col items-center justify-center z-20",
      "rounded-lg",
      className
    )}>
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold text-foreground">
          {message}
        </p>
        <p className="text-xs text-muted-foreground">
          May take 8-10 seconds
        </p>
      </div>
    </div>
  );
};
