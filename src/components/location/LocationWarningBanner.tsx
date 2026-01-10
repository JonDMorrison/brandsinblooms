import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LocationWarningBannerProps {
  variant?: 'inline' | 'banner';
  onDismiss?: () => void;
}

export const LocationWarningBanner: React.FC<LocationWarningBannerProps> = ({
  variant = 'inline',
  onDismiss,
}) => {
  if (variant === 'banner') {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              <span className="font-medium">Location not confirmed.</span>{' '}
              Content may not be optimized for your area.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings?tab=business-profile">
                <MapPin className="h-4 w-4 mr-1" />
                Confirm Location
              </Link>
            </Button>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Alert variant="default" className="border-yellow-300 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="text-yellow-800">Location Not Confirmed</AlertTitle>
      <AlertDescription className="text-yellow-700">
        <p className="mb-2">
          We couldn't confidently detect your business location. Content generated 
          may not be optimized for your local area.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings?tab=business-profile">
            <MapPin className="h-4 w-4 mr-1" />
            Confirm Your Location
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
};
