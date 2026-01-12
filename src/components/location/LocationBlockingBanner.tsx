import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LocationBlockingBannerProps {
  className?: string;
}

/**
 * A blocking banner that displays when a legacy profile needs location confirmation.
 * This banner is non-dismissible and routes users to the settings page.
 */
export const LocationBlockingBanner: React.FC<LocationBlockingBannerProps> = ({
  className = '',
}) => {
  return (
    <div className={`bg-muted border-b-2 border-border px-4 py-4 ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-start sm:items-center gap-3">
          <div className="bg-secondary/10 p-2 rounded-full flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Confirm your primary location to generate local content
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Location-based content generation is blocked until you confirm your business location.
            </p>
          </div>
        </div>
        <Button 
          variant="default" 
          size="sm" 
          asChild
          className="flex-shrink-0"
        >
          <Link to="/profile/company">
            <MapPin className="h-4 w-4 mr-1.5" />
            Confirm Location
          </Link>
        </Button>
      </div>
    </div>
  );
};
