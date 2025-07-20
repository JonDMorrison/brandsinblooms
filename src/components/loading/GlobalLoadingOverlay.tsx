import React from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const GlobalLoadingOverlay = () => {
  const { currentLoading } = useLoading();

  console.log('🔄 GlobalLoadingOverlay render:', { 
    hasCurrentLoading: !!currentLoading,
    message: currentLoading?.message,
    priority: currentLoading?.priority 
  });

  if (!currentLoading) return null;

  return (
    <div className="fixed inset-0 bg-garden-background z-50 flex items-center justify-center">
      <LoadingSpinner 
        size="lg" 
        color="primary" 
        variant="default"
        text={currentLoading.message}
      />
    </div>
  );
};