import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TextContentSkeletonProps {
  className?: string;
  showHeadline?: boolean;
  showBody?: boolean;
  bodyLines?: number;
}

export const TextContentSkeleton: React.FC<TextContentSkeletonProps> = ({
  className,
  showHeadline = true,
  showBody = true,
  bodyLines = 6
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Headline skeleton */}
      {showHeadline && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4" animation="wave" />
        </div>
      )}
      
      {/* Body text skeleton */}
      {showBody && (
        <div className="space-y-3">
          {Array.from({ length: bodyLines }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-4",
                i === bodyLines - 1 ? "w-2/3" : "w-full"
              )}
              animation="wave"
            />
          ))}
        </div>
      )}
    </div>
  );
};
