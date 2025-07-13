import React, { Suspense, useEffect, useId } from 'react';
import { Loader2 } from 'lucide-react';
import { useLoading } from '@/contexts/LoadingContext';

interface LazyLoadWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  loadingText?: string;
}

const DefaultFallback = ({ text = "Loading..." }: { text?: string }) => (
  <div className="flex items-center justify-center min-h-[200px] w-full">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  </div>
);

export const LazyLoadWrapper: React.FC<LazyLoadWrapperProps> = ({ 
  children, 
  fallback,
  className = "",
  loadingText
}) => {
  // Simple fallback without global loading integration
  const simpleFallback = fallback || (
    <div className="flex items-center justify-center min-h-[200px] w-full">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{loadingText || "Loading..."}</p>
      </div>
    </div>
  );

  return (
    <div className={className}>
      <Suspense fallback={simpleFallback}>
        {children}
      </Suspense>
    </div>
  );
};