import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, ShoppingBag, Gift, TrendingUp, Crown } from 'lucide-react';

interface SegmentOverviewCardProps {
  name: string;
  description: string;
  estimatedCount?: number;
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
  icon,
  isSystem = true,
  onCreateCampaign,
  onViewDetails,
}) => {
  const IconComponent = iconMap[icon];
  const loading = estimatedCount === undefined;

  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base">{name}</h3>
              {isSystem && (
                <Badge variant="secondary" className="text-xs mt-1">
                  System
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {description}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {loading ? 'Loading...' : `${estimatedCount || 0} customers`}
            </span>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onViewDetails}>
              View
            </Button>
            <Button size="sm" onClick={onCreateCampaign}>
              Campaign
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};