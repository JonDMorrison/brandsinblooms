import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface BlockGeneratingOverlayProps {
  className?: string;
  message?: string;
}

export const BlockGeneratingOverlay: React.FC<BlockGeneratingOverlayProps> = ({ 
  className, 
  message = "AI is writing content..." 
}) => {
  return (
    <div className={cn(
      "absolute inset-0 bg-background/90 backdrop-blur-sm",
      "flex flex-col items-center justify-center z-20",
      "border border-dashed border-primary/30 rounded-lg",
      className
    )}>
      <div className="text-center space-y-3">
        <LoadingSpinner 
          size="lg" 
          color="primary"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {message}
          </p>
          <p className="text-xs text-muted-foreground">
            This will only take a moment
          </p>
        </div>
      </div>
    </div>
  );
};