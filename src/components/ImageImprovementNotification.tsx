import React, { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const ImageImprovementNotification = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if we've shown this notification before
    const hasSeenNotification = localStorage.getItem('garden-center-images-notification');
    
    if (!hasSeenNotification) {
      // Show notification after a short delay
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('garden-center-images-notification', 'true');
  };

  if (!isVisible) return null;

  return (
    <Card className="fixed bottom-4 right-4 p-4 max-w-sm shadow-lg border-green-200 bg-green-50 z-50">
      <div className="flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-green-900 text-sm">Images Improved!</h4>
          <p className="text-green-800 text-xs mt-1">
            We've replaced random placeholder images with beautiful, relevant garden center images that match your content perfectly.
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleDismiss}
          className="h-6 w-6 p-0 hover:bg-green-100"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};