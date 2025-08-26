import React from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const GlobalLoadingOverlay = () => {
  const { currentLoading } = useLoading();

  console.log('🔄 GlobalLoadingOverlay render:', { 
    hasCurrentLoading: !!currentLoading,
    message: currentLoading?.message,
    priority: currentLoading?.priority,
    isLoading: currentLoading?.isLoading
  });

  if (!currentLoading) return null;

  return (
    <div className="fixed inset-0 bg-garden-background/80 backdrop-blur-sm z-40 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto">
        <LoadingSpinner 
          size="lg" 
          color="primary" 
          variant="default"
          text={currentLoading.message}
        />
      </div>
    </div>
  );
};