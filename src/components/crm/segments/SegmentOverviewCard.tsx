import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Mail, ShoppingBag, Gift, TrendingUp, Crown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SegmentOverviewCardProps {
  name: string;
  description: string;
  estimatedCount?: number;
  isLoadingCount?: boolean;
  icon: 'users' | 'mail' | 'shopping' | 'gift' | 'trending' | 'crown';
  isSystem?: boolean;
  onCreateCampaign?: () => void;
  onViewDetails?: () => void;
}

const iconMap = {
  users: Users,
  mail: Mail,
  shopping: ShoppingBag,
  gift: Gift,
  trending: TrendingUp,
  crown: Crown,
};

export const SegmentOverviewCard: React.FC<SegmentOverviewCardProps> = ({
  name,
  description,
  estimatedCount,
  isLoadingCount = false,
  icon,
  isSystem = true,
  onCreateCampaign,
  onViewDetails,
}) => {
  const IconComponent = iconMap[icon];
  const loading = isLoadingCount || estimatedCount === undefined;
  const isMobile = useIsMobile();

  // Debug logging
  console.log('🔧 SegmentOverviewCard render:', { 
    name, 
    estimatedCount, 
    isLoadingCount, 
    loading,
    finalCount: estimatedCount || 0
  });

  return (
    <Card className="h-full mobile-hover-lift mobile-card">
      <CardContent className={`${isMobile ? 'p-4' : 'p-6'} mobile-space-normal`}>
        {/* Header section with icon and title */}
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-start justify-between'} mb-4`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg mobile-touch-target">
              <IconComponent className={`${isMobile ? 'mobile-icon-md' : 'h-5 w-5'} text-primary`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold ${isMobile ? 'mobile-text-subheading' : 'text-base'} mobile-prevent-overflow`}>
                {name}
              </h3>
            </div>
          </div>
        </div>
        
        {/* Description */}
        <p className={`${isMobile ? 'mobile-text-body' : 'text-sm'} text-muted-foreground mb-4 line-clamp-2 mobile-text-balance`}>
          {description}
        </p>
        
        {/* Footer with customer count and buttons */}
        <div className={`${isMobile ? 'space-y-3 w-full' : 'space-y-3'}`}>
          {/* Customer count */}
          {loading ? (
            <div className="flex items-center gap-2">
              <Skeleton className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'} rounded-full`} />
              <Skeleton className={`${isMobile ? 'h-6 w-32' : 'h-5 w-28'}`} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Users className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'} text-muted-foreground`} />
              <span className={`${isMobile ? 'mobile-text-caption' : 'text-sm'} font-medium`}>
                {`${estimatedCount || 0} customers`}
              </span>
            </div>
          )}
          
          {/* Action buttons */}
          <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'flex-col sm:flex-row gap-2'}`}>
            <Button 
              variant="outline" 
              size={isMobile ? "default" : "sm"} 
              onClick={onViewDetails}
              className={`${isMobile ? 'w-full min-h-[44px]' : 'flex-1 min-w-0'}`}
            >
              View Details
            </Button>
            <Button 
              size={isMobile ? "default" : "sm"} 
              onClick={onCreateCampaign}
              className={`${isMobile ? 'w-full min-h-[44px]' : 'flex-1 min-w-0'}`}
            >
              Create Campaign
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};