import React from 'react';
import { Facebook, Instagram, Loader2 } from 'lucide-react';

interface OAuthLoadingOverlayProps {
  isVisible: boolean;
  step: 'preparing' | 'redirecting';
}

export const OAuthLoadingOverlay: React.FC<OAuthLoadingOverlayProps> = ({ 
  isVisible, 
  step 
}) => {
  if (!isVisible) return null;

  const stepMessages = {
    preparing: 'Preparing your connection...',
    redirecting: 'Redirecting to Meta...'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-lg p-6 md:p-8 max-w-sm w-full mx-4 shadow-lg">
        <div className="text-center space-y-4">
          {/* Meta Branding */}
          <div className="flex justify-center items-center space-x-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Facebook className="w-6 h-6 text-white" />
            </div>
            <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
              <Instagram className="w-6 h-6 text-white" />
            </div>
          </div>
          
          {/* Loading Spinner */}
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          
          {/* Step Message */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-gray-900">Connecting to Meta</h3>
            <p className="text-gray-600">{stepMessages[step]}</p>
          </div>
          
          {/* Progress Steps */}
          <div className="flex justify-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${step === 'preparing' ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'redirecting' ? 'bg-primary' : 'bg-muted'}`} />
          </div>
          
          <p className="text-xs text-gray-500">
            You'll be redirected to Meta to authorize the connection
          </p>
        </div>
      </div>
    </div>
  );
};