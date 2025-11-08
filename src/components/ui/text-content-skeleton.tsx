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
  bodyLines = 7
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Headline skeleton - 2 thick lines */}
      {showHeadline && (
        <div className="space-y-2">
          <Skeleton className="h-7 w-[90%]" animation="wave" />
          <Skeleton className="h-7 w-[75%]" animation="wave" />
        </div>
      )}
      
      {/* Body text skeleton - 7 thin lines */}
      {showBody && (
        <div className="space-y-2.5">
          {Array.from({ length: bodyLines }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-3.5",
                i === bodyLines - 1 ? "w-[60%]" : "w-full"
              )}
              animation="wave"
            />
          ))}
        </div>
      )}
    </div>
  );
};
