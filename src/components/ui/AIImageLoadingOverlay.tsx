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
      "absolute inset-0",
      "flex flex-col items-center justify-center z-20",
      "rounded-lg",
      className
    )}>
      {/* Empty overlay - no visible content */}
    </div>
  );
};
