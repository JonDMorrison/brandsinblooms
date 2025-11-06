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
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm z-10">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-black dark:text-white">{message}</p>
          <p className="text-xs text-black/70 dark:text-white/70">8-10 seconds</p>
        </div>
      </div>
    </div>
  );
};
