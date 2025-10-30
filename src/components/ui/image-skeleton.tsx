import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon } from 'lucide-react';
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
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon className="w-12 h-12 text-gray-400 opacity-50" />
        </div>
      )}
    </div>
  );
};
