import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardSection } from './DashboardSection';
import { RadialGauge } from '@/components/ui/radial-gauge';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Ban, 
  Bell, 
  Tag, 
  Mail,
  TrendingDown
} from 'lucide-react';

interface RiskNegativeSignalsProps {
  metrics: {
    overallRiskScore?: number;
    riskLevel?: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
    riskTrend?: 'improving' | 'stable' | 'worsening';
    optOutRiskScore?: number;
    ignoreStreakRiskScore?: number;
    engagementGapRiskScore?: number;
    incentiveAbuseRiskScore?: number;
    couponDependencyRiskScore?: number;
    dormancyRiskScore?: number;
    bounceRiskScore?: number;
    riskFactors?: string[];
    shouldSuppress?: boolean;
  };
  recentEvents?: Array<{
    id: string;
    type: string;
    timestamp: string;
    description: string;
  }>;
  engagementDecay?: number[];
  className?: string;
}

const riskLevelStyles: Record<string, { bg: string; text: string; border: string }> = {
  minimal: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  low: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  moderate: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

const riskTypeIcons: Record<string, React.ReactNode> = {
  opt_out: <Ban className="h-4 w-4" />,
  ignoring: <Bell className="h-4 w-4" />,
  coupon: <Tag className="h-4 w-4" />,
  bounce: <Mail className="h-4 w-4" />,
};

const getRiskLabel = (score: number): string => {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Low';
  return 'Minimal';
};

const getRiskColor = (score: number): string => {
  if (score >= 80) return 'hsl(0 84% 60%)';
  if (score >= 60) return 'hsl(25 95% 53%)';
  if (score >= 40) return 'hsl(45 93% 47%)';
  if (score >= 20) return 'hsl(142 76% 50%)';
  return 'hsl(142 76% 36%)';
};

export const RiskNegativeSignals: React.FC<RiskNegativeSignalsProps> = ({
  metrics,
  recentEvents = [],
  engagementDecay = [],
  className,
}) => {
  const riskLevel = metrics.riskLevel || 'low';
  const levelStyle = riskLevelStyles[riskLevel];

  const riskIndicators = [
    { key: 'opt_out', label: 'Opt-Out Risk', score: metrics.optOutRiskScore || 0, icon: <Ban className="h-3.5 w-3.5" /> },
    { key: 'ignoring', label: 'Ignoring Risk', score: metrics.ignoreStreakRiskScore || 0, icon: <Bell className="h-3.5 w-3.5" /> },
    { key: 'coupon', label: 'Coupon Dependency', score: metrics.couponDependencyRiskScore || 0, icon: <Tag className="h-3.5 w-3.5" /> },
    { key: 'bounce', label: 'Bounce Risk', score: metrics.bounceRiskScore || 0, icon: <Mail className="h-3.5 w-3.5" /> },
  ];

  // Sample decay data if none provided
  const decayData = engagementDecay.length > 0 ? engagementDecay : [100, 95, 85, 72, 58, 45, 32, 25, 20, 18];

  return (
    <DashboardSection
      title="Risk & Negative Signals"
      icon={<ShieldAlert className="h-4 w-4" />}
      tooltip="Monitor warning signs and negative behavior patterns"
      variant={riskLevel === 'critical' || riskLevel === 'high' ? 'critical' : 
               riskLevel === 'moderate' ? 'warning' : 'default'}
      badge={
        <Badge className={cn('ml-2 text-xs', levelStyle.bg, levelStyle.text, levelStyle.border)}>
          {riskLevel.toUpperCase()}
        </Badge>
      }
      className={className}
    >
      {/* Main Risk Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Overall Risk Gauge */}
        <div className="flex flex-col items-center p-4 rounded-lg border border-border bg-card">
          <RadialGauge
            value={metrics.overallRiskScore || 0}
            size="lg"
            variant="risk"
            showValue={true}
          />
          <div className="text-center mt-2">
            <p className={cn('text-sm font-semibold', levelStyle.text)}>
              {getRiskLabel(metrics.overallRiskScore || 0)} Risk
            </p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              Trend: 
              {metrics.riskTrend === 'worsening' && (
                <span className="text-red-600 flex items-center gap-0.5">
                  <TrendingDown className="h-3 w-3" /> Worsening
                </span>
              )}
              {metrics.riskTrend === 'improving' && (
                <span className="text-green-600">Improving ↑</span>
              )}
              {metrics.riskTrend === 'stable' && (
                <span className="text-muted-foreground">Stable →</span>
              )}
            </p>
          </div>
          
          {/* Active Risk Factors */}
          {metrics.riskFactors && metrics.riskFactors.length > 0 && (
            <div className="mt-3 w-full">
              <p className="text-xs text-muted-foreground mb-2">Active Risk Factors:</p>
              <div className="space-y-1">
                {metrics.riskFactors.slice(0, 3).map((factor, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-foreground">{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Risk Indicators */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {riskIndicators.map((indicator) => (
            <div 
              key={indicator.key}
              className="p-3 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{indicator.icon}</span>
                  <span className="text-xs text-foreground font-medium">
                    {indicator.label}
                  </span>
                </div>
                <span 
                  className="text-sm font-bold"
                  style={{ color: getRiskColor(indicator.score) }}
                >
                  {indicator.score}
                </span>
              </div>
              <Progress 
                value={indicator.score} 
                className="h-1.5"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Engagement Decay Curve */}
      <div className="p-4 rounded-lg border border-border bg-card mb-4">
        <h4 className="text-sm font-medium text-foreground mb-3">Engagement Decay Curve</h4>
        <div className="h-20 flex items-end gap-1">
          {decayData.map((value, index) => (
            <div 
              key={index}
              className="flex-1 rounded-t transition-all"
              style={{ 
                height: `${value}%`,
                backgroundColor: getRiskColor(100 - value),
                opacity: 0.7 + (index / decayData.length) * 0.3
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          <span>Week 1</span>
          <span>Current</span>
        </div>
      </div>

      {/* Recent Negative Events */}
      {recentEvents.length > 0 && (
        <div className="p-4 rounded-lg border border-border bg-card">
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Recent Negative Events
          </h4>
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div 
                  key={event.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-muted/30"
                >
                  <span className="text-muted-foreground mt-0.5">
                    {riskTypeIcons[event.type] || <AlertTriangle className="h-4 w-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">{event.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(event.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Suppression Warning */}
      {metrics.shouldSuppress && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-700">Suppression Recommended</p>
              <p className="text-xs text-red-600">
                This customer should be suppressed from marketing communications
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardSection>
  );
};

export default RiskNegativeSignals;
