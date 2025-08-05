import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface BlockLoadingOverlayProps {
  className?: string;
}

export const BlockLoadingOverlay: React.FC<BlockLoadingOverlayProps> = ({ 
  className 
}) => {
  return (
    <div className={cn(
      "absolute inset-0 bg-background/80 backdrop-blur-sm",
      "flex items-center justify-center z-10",
      "border border-dashed border-primary/30 rounded-lg",
      className
    )}>
      <div className="text-center">
        <LoadingSpinner 
          size="md" 
          color="primary"
          text="Generating content..."
        />
        <p className="text-xs text-muted-foreground mt-2">
          AI is creating your content
        </p>
      </div>
    </div>
  );
};