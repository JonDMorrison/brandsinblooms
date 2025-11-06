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
      "absolute inset-0 bg-background/95 backdrop-blur-sm",
      "flex flex-col items-center justify-center z-20",
      "rounded-lg",
      className
    )}>
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-semibold text-black dark:text-white">
            {message}
          </p>
          <p className="text-xs text-black/70 dark:text-white/70">
            This will take about 8-10 seconds
          </p>
        </div>
      </div>
    </div>
  );
};
