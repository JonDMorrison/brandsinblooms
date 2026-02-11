import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Mail, ShoppingBag, Gift, TrendingUp, Crown, Plus, Loader2, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { ResolvedSegment } from '@/utils/segmentResolution';

const iconMap = {
  users: Users,
  mail: Mail,
  shopping: ShoppingBag,
  gift: Gift,
  trending: TrendingUp,
  crown: Crown,
};

interface SystemSegmentCardProps {
  segment: ResolvedSegment;
  icon: keyof typeof iconMap;
  isActivating?: boolean;
  hasDuplicate?: boolean;
  onAdd?: () => void;
  onUpgrade?: () => void;
  onViewDetails?: () => void;
  onCreateCampaign?: () => void;
}

export const SystemSegmentCard: React.FC<SystemSegmentCardProps> = ({
  segment,
  icon,
  isActivating,
  hasDuplicate,
  onAdd,
  onUpgrade,
  onViewDetails,
  onCreateCampaign,
}) => {
  const IconComponent = iconMap[icon] || Users;
  const isPending = segment.state === 'system_pending';
  const isUserCreated = segment.state === 'user'; // Name matches system def but not flagged as system

  return (
    <Card
      className={`h-full relative transition-all ${
        isPending
          ? 'border-dashed border-muted-foreground/30 bg-muted/30'
          : ''
      }`}
    >
      <CardContent className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3 pr-2">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isPending ? 'bg-muted' : 'bg-primary/10'
            }`}
          >
            <IconComponent
              className={`h-5 w-5 ${
                isPending ? 'text-muted-foreground' : 'text-primary'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`font-semibold text-sm truncate ${
                  isPending ? 'text-muted-foreground' : 'text-foreground'
                }`}
              >
                {segment.name}
              </h3>
              {!isPending && !isUserCreated && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 cursor-help">
                        System
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">System segments are predefined and their names cannot be changed.</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {isUserCreated && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 cursor-help border-amber-500/30 text-amber-600">
                        User
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">This segment was created manually. Upgrade it to a system segment to enable name protection.</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {hasDuplicate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">Multiple segments share this name. Consider consolidating them.</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p
              className={`text-xs mt-0.5 line-clamp-2 ${
                isPending ? 'text-muted-foreground/70' : 'text-muted-foreground'
              }`}
            >
              {segment.description}
            </p>
          </div>
        </div>

        {/* Footer */}
        {isPending ? (
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={onAdd}
              disabled={isActivating}
            >
              {isActivating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isActivating ? 'Activating...' : 'Add Segment'}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              Predefined — click to activate
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">
                {segment.customer_count} customers
              </span>
            </div>
            {isUserCreated && onUpgrade ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={onUpgrade}
                >
                  <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                  Upgrade to System
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={onViewDetails}
                >
                  View Details
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={onViewDetails}
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={onCreateCampaign}
                >
                  Create Campaign
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
