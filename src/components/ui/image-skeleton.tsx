import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface ImageSkeletonProps {
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait';
  showIcon?: boolean;
}

export const ImageSkeleton: React.FC<ImageSkeletonProps> = ({
  className,
  aspectRatio = 'video',
  showIcon = true
}) => {
  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]'
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg",
      aspectRatioClasses[aspectRatio],
      className
    )}>
      <Skeleton className="w-full h-full animate-gentle-pulse" animation="pulse" />
      {showIcon && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner size="lg" color="primary" />
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Generating Image</p>
            <p className="text-xs text-muted-foreground">This may take 8 - 12 seconds</p>
          </div>
        </div>
      )}
    </div>
  );
};
