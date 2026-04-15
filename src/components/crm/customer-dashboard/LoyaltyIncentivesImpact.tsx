import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { Progress } from '@/components/ui-legacy/progress';
import { Badge } from '@/components/ui-legacy/badge';
import { Star, Gift, TrendingUp, Clock, Award } from 'lucide-react';

interface LoyaltyIncentivesImpactProps {
  metrics: {
    isPerksEnrolled?: boolean;
    currentTier?: string;
    pointsEarned?: number;
    pointsRedeemed?: number;
    pointsBalance?: number;
    redemptionFrequency?: number;
    avgRedemptionDelay?: number;
    perksRevenue?: number;
    totalRevenue?: number;
    tierProgressPercent?: number;
    nextTier?: string;
    pointsToNextTier?: number;
    memberEngagementDelta?: number;
    joinedPerksAt?: string;
  };
  tierTimeline?: Array<{
    tier: string;
    reachedAt: string;
    daysToReach: number;
  }>;
  className?: string;
}

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-600',
  silver: 'bg-gray-400',
  gold: 'bg-yellow-500',
  platinum: 'bg-purple-600',
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const LoyaltyIncentivesImpact: React.FC<LoyaltyIncentivesImpactProps> = ({
  metrics,
  tierTimeline = [],
  className,
}) => {
  const perksRevenuePercentage = metrics.totalRevenue && metrics.perksRevenue
    ? Math.round((metrics.perksRevenue / metrics.totalRevenue) * 100)
    : 0;

  const isQuickRedeemer = (metrics.avgRedemptionDelay || 0) < 14;

  // Sample tier timeline if not provided
  const timeline = tierTimeline.length > 0 ? tierTimeline : [
    { tier: 'Bronze', reachedAt: 'Signup', daysToReach: 0 },
    { tier: 'Silver', reachedAt: '+45 days', daysToReach: 45 },
    { tier: 'Gold', reachedAt: '+120 days', daysToReach: 120 },
  ];

  const currentTierIndex = timeline.findIndex(
    t => t.tier.toLowerCase() === (metrics.currentTier?.toLowerCase() || 'bronze')
  );

  return (
    <DashboardSection
      title="Loyalty & Incentives Impact"
      icon={<Star className="h-4 w-4" />}
      tooltip="Track loyalty program engagement, points activity, and tier progression"
      badge={metrics.currentTier ? (
        <Badge className={cn(
          'ml-2 text-white text-xs',
          tierColors[metrics.currentTier.toLowerCase()] || 'bg-gray-500'
        )}>
          ⭐ {metrics.currentTier} Member
        </Badge>
      ) : undefined}
      className={className}
    >
      {!metrics.isPerksEnrolled ? (
        <div className="text-center py-8">
          <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Not enrolled in loyalty program</p>
          <p className="text-xs text-muted-foreground mt-1">
            Opportunity to increase engagement through perks enrollment
          </p>
        </div>
      ) : (
        <>
          {/* Points Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-lg border border-border bg-card">
              <h4 className="text-sm font-medium text-foreground mb-4">Points Activity</h4>
              
              <div className="space-y-4">
                {/* Earned */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Earned</span>
                    <span className="text-sm font-semibold text-green-600">
                      {(metrics.pointsEarned || 0).toLocaleString()} pts
                    </span>
                  </div>
                  <Progress 
                    value={100} 
                    className="h-2"
                  />
                </div>
                
                {/* Redeemed */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Redeemed</span>
                    <span className="text-sm font-semibold text-brand-teal-600">
                      {(metrics.pointsRedeemed || 0).toLocaleString()} pts
                    </span>
                  </div>
                  <Progress 
                    value={metrics.pointsEarned ? (metrics.pointsRedeemed || 0) / metrics.pointsEarned * 100 : 0} 
                    className="h-2"
                  />
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Current Balance</span>
                  <span className="text-lg font-bold text-foreground">
                    {(metrics.pointsBalance || 0).toLocaleString()} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Redemption Behavior & Perks Revenue */}
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-sm font-medium text-foreground mb-3">Redemption Behavior</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Avg Delay</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-foreground">
                      {metrics.avgRedemptionDelay || 0} days
                    </span>
                    {isQuickRedeemer && (
                      <Badge variant="outline" className="text-green-700 border-green-200 text-xs">
                        Quick Redeemer
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-card">
                <h4 className="text-sm font-medium text-foreground mb-3">Perks-Driven Revenue</h4>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        stroke="hsl(var(--muted))"
                        strokeWidth="8"
                        fill="none"
                        className="opacity-30"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        stroke="hsl(174 63% 57%)"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${perksRevenuePercentage * 2.01} 201`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-foreground">
                        {perksRevenuePercentage}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {formatCurrency(metrics.perksRevenue || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">from perks purchases</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tier Progression Timeline */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <h4 className="text-sm font-medium text-foreground mb-4">Tier Progression</h4>
            
            <div className="relative">
              {/* Progress line */}
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
              <div 
                className="absolute top-4 left-0 h-0.5 bg-brand-teal transition-all"
                style={{ 
                  width: `${Math.min(((currentTierIndex + 1) / timeline.length) * 100, 100)}%` 
                }}
              />
              
              {/* Tier markers */}
              <div className="relative flex justify-between">
                {timeline.map((tier, index) => {
                  const isReached = index <= currentTierIndex;
                  const isCurrent = index === currentTierIndex;
                  
                  return (
                    <div key={tier.tier} className="flex flex-col items-center">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all',
                        isReached 
                          ? tierColors[tier.tier.toLowerCase()] || 'bg-brand-teal' 
                          : 'bg-muted border-2 border-border',
                        isReached ? 'text-white' : 'text-muted-foreground'
                      )}>
                        {isReached ? (
                          <Award className="h-4 w-4" />
                        ) : (
                          <span className="text-xs">○</span>
                        )}
                      </div>
                      <span className={cn(
                        'text-xs mt-2 font-medium',
                        isCurrent ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {tier.tier}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tier.reachedAt}
                      </span>
                    </div>
                  );
                })}
                
                {/* Next tier placeholder if exists */}
                {metrics.nextTier && (
                  <div className="flex flex-col items-center opacity-50">
                    <div className="w-8 h-8 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">?</span>
                    </div>
                    <span className="text-xs mt-2 text-muted-foreground">{metrics.nextTier}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {metrics.pointsToNextTier} pts needed
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Progression Speed */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>
                Progression Speed: <span className="font-medium text-foreground">
                  {currentTierIndex > 0 
                    ? `~${Math.round(timeline[currentTierIndex]?.daysToReach / currentTierIndex)} days/tier` 
                    : 'Just started'
                  }
                </span>
              </span>
            </div>
          </div>
        </>
      )}
    </DashboardSection>
  );
};

export default LoyaltyIncentivesImpact;
