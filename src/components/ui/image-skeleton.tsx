import React from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageSkeletonProps {
  className?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
  showIcon?: boolean;
}

export const ImageSkeleton: React.FC<ImageSkeletonProps> = ({
  className,
  aspectRatio = 'auto',
  showIcon = true
}) => {
  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: 'h-48'
  };

  return (
    <div 
      className={cn(
        "w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden",
        "animate-pulse relative",
        aspectClasses[aspectRatio],
        className
      )}
    >
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      
      {showIcon && (
        <div className="text-center text-muted-foreground z-10">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          <p className="text-sm font-medium">Loading image...</p>
        </div>
      )}
    </div>
  );
};