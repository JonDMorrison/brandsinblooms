import React from 'react';
import { Plug, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LightspeedOAuthOverlayProps {
  isVisible: boolean;
  step: 'preparing' | 'redirecting' | 'completing';
  onCancel?: () => void;
}

export const LightspeedOAuthOverlay: React.FC<LightspeedOAuthOverlayProps> = ({ 
  isVisible, 
  step,
  onCancel 
}) => {
  if (!isVisible) return null;

  const stepMessages = {
    preparing: 'Preparing your connection...',
    redirecting: 'Opening Lightspeed authorization...',
    completing: 'Completing connection...'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-lg p-6 md:p-8 max-w-sm w-full mx-4 shadow-lg relative">
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={onCancel}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="text-center space-y-4">
          {/* Lightspeed Branding */}
          <div className="flex justify-center items-center">
            <div className="p-3 bg-primary rounded-lg">
              <Plug className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          
          {/* Loading Spinner */}
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          
          {/* Step Message */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Connecting to Lightspeed</h3>
            <p className="text-muted-foreground">{stepMessages[step]}</p>
          </div>
          
          {/* Progress Steps */}
          <div className="flex justify-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${step === 'preparing' ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'redirecting' ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'completing' ? 'bg-primary' : 'bg-muted'}`} />
          </div>
          
          <p className="text-xs text-muted-foreground">
            You'll be redirected to Lightspeed to authorize the connection
          </p>
        </div>
      </div>
    </div>
  );
};
