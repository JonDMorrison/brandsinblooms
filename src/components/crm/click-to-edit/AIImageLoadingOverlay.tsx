import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface AIImageLoadingOverlayProps {
  message?: string;
  showIcon?: boolean;
}

export const AIImageLoadingOverlay: React.FC<AIImageLoadingOverlayProps> = ({
  message = 'Generating image with AI...',
  showIcon = true
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
      <div className="flex flex-col items-center gap-3 text-center p-4">
        {showIcon && (
          <div className="relative">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <Loader2 className="w-8 h-8 text-primary animate-spin absolute inset-0" />
          </div>
        )}
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
};
