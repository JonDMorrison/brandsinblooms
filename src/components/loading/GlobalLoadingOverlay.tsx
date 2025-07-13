import React from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const GlobalLoadingOverlay = () => {
  const { currentLoading } = useLoading();

  if (!currentLoading) return null;

  return (
    <div className="min-h-screen bg-garden-background">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <LoadingSpinner 
              size="lg" 
              color="primary" 
              variant="default"
              text={currentLoading.message}
            />
          </div>
        </div>
      </div>
    </div>
  );
};