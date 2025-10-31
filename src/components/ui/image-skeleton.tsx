import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
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
      <Skeleton className="w-full h-full" animation="wave" />
      {showIcon && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Generating image</p>
        </div>
      )}
    </div>
  );
};
