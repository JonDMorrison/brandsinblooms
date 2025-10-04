import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIImageLoadingOverlayProps {
  className?: string;
  message?: string;
  showIcon?: boolean;
}

export const AIImageLoadingOverlay: React.FC<AIImageLoadingOverlayProps> = ({ 
  className, 
  message = "AI is creating your garden image...",
  showIcon = true
}) => {
  return (
    <div className={cn(
      "absolute inset-0 bg-background/90 backdrop-blur-sm",
      "flex flex-col items-center justify-center z-20",
      "rounded-lg",
      className
    )}>
      <div className="text-center space-y-4">
        {showIcon && (
          <div className="relative">
            <ImageIcon className="w-16 h-16 mx-auto text-primary/40 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          </div>
        )}
        
        <LoadingSpinner 
          size="lg" 
          color="primary"
        />
        
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {message}
          </p>
          <p className="text-xs text-muted-foreground">
            This will take about 8-10 seconds
          </p>
        </div>
      </div>
    </div>
  );
};
