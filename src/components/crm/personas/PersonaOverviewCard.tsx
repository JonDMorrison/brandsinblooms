import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, ShoppingBag, Gift, TrendingUp, Crown, Leaf, Heart, Apple, Recycle, Home, Flower, Eye, Hammer, Sun } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PersonaOverviewCardProps {
  name: string;
  description: string;
  customerCount?: number;
  icon: 'users' | 'mail' | 'shopping' | 'gift' | 'trending' | 'crown' | 'leaf' | 'heart' | 'apple' | 'recycle' | 'home' | 'flower' | 'eye' | 'hammer' | 'sun';
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
  leaf: Leaf,
  heart: Heart,
  apple: Apple,
  recycle: Recycle,
  home: Home,
  flower: Flower,
  eye: Eye,
  hammer: Hammer,
  sun: Sun,
};

export const PersonaOverviewCard: React.FC<PersonaOverviewCardProps> = ({
  name,
  description,
  customerCount,
  icon,
  isSystem = true,
  onCreateCampaign,
  onViewDetails,
}) => {
  const IconComponent = iconMap[icon];
  const loading = customerCount === undefined;
  const isMobile = useIsMobile();

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
              {isSystem && (
                <Badge variant="secondary" className="text-xs mt-1">
                  System
                </Badge>
              )}
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
          <div className="flex items-center gap-2">
            <Users className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'} text-muted-foreground`} />
            <span className={`${isMobile ? 'mobile-text-caption' : 'text-sm'} font-medium`}>
              {loading ? 'Loading...' : `${customerCount || 0} customers`}
            </span>
          </div>
          
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