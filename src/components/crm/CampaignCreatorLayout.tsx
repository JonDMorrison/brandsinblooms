
import React from 'react';
import { cn } from '@/lib/utils';

interface CampaignCreatorLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const CampaignCreatorLayout: React.FC<CampaignCreatorLayoutProps> = ({
  children,
  className
}) => {
  return (
    <div className={cn(
      "min-h-screen bg-background",
      "mobile-safe-area", // Apply mobile safe area from CSS
      className
    )}>
      <div className="max-w-full mx-auto mobile-container-constraint">
        {children}
      </div>
    </div>
  );
};

interface CampaignSettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

export const CampaignSettingsCard: React.FC<CampaignSettingsCardProps> = ({
  children,
  className
}) => {
  return (
    <div className={cn(
      "w-full",
      "mobile-card-spacing", // Apply mobile card spacing from CSS
      className
    )}>
      {children}
    </div>
  );
};

interface CampaignContentGridProps {
  children: React.ReactNode;
  className?: string;
}

export const CampaignContentGrid: React.FC<CampaignContentGridProps> = ({
  children,
  className
}) => {
  return (
    <div className={cn(
      // Mobile-first responsive grid
      "grid grid-cols-1 gap-4",
      "lg:grid-cols-2 lg:gap-6",
      "xl:gap-8",
      // Mobile optimization
      "mobile-space-normal",
      className
    )}>
      {children}
    </div>
  );
};
