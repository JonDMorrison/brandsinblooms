import React from 'react';
import { cn } from '@/lib/utils';

interface AIImageLoadingOverlayProps {
  message?: string;
  className?: string;
}

export const AIImageLoadingOverlay: React.FC<AIImageLoadingOverlayProps> = ({
  message = 'Generating Images',
  className
}) => {
  return (
    <div className={cn(
      "absolute inset-0 flex flex-col items-center justify-center z-50 rounded-lg",
      className
    )}>
      {/* Empty overlay - no visible content */}
    </div>
  );
};
