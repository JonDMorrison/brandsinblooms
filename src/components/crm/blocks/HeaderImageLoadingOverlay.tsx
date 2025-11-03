import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { Image, Sparkles } from 'lucide-react';

type Stage = 'waiting' | 'aggregating' | 'fetching' | 'complete' | 'error';

interface HeaderImageLoadingOverlayProps {
  stage: Stage;
  className?: string;
}

const stageConfig = {
  waiting: {
    icon: Image,
    message: 'Waiting for content generation...',
    description: 'Preparing to create your header image'
  },
  aggregating: {
    icon: Sparkles,
    message: 'Analyzing content...',
    description: 'Finding the perfect image for your newsletter'
  },
  fetching: {
    icon: Image,
    message: 'Generating image with AI...',
    description: 'Searching for the best visual match'
  },
  complete: {
    icon: Image,
    message: 'Complete!',
    description: 'Header image applied successfully'
  },
  error: {
    icon: Image,
    message: 'Unable to generate image',
    description: 'Using default background'
  }
};

export const HeaderImageLoadingOverlay: React.FC<HeaderImageLoadingOverlayProps> = ({ 
  stage,
  className 
}) => {
  const config = stageConfig[stage];
  const Icon = config.icon;

  return (
    <div className={cn(
      "absolute inset-0 bg-background/90 backdrop-blur-sm",
      "flex items-center justify-center z-20",
      "border border-dashed border-primary/30 rounded-lg",
      className
    )}>
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <Icon className="w-5 h-5 text-primary" />
          {stage !== 'complete' && stage !== 'error' && (
            <LoadingSpinner 
              size="sm" 
              color="primary"
            />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {config.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
};
