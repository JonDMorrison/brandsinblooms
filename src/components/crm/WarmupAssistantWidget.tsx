import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Flame, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  Mail,
  Calendar,
  Shield
} from 'lucide-react';
import { useWarmupStatus, DomainWarmupStatus } from '@/hooks/useWarmupStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const STAGE_COLORS: Record<number, string> = {
  0: 'bg-orange-500',
  1: 'bg-amber-500',
  2: 'bg-yellow-500',
  3: 'bg-lime-500',
  4: 'bg-green-500',
};

const STAGE_ICONS: Record<number, React.ReactNode> = {
  0: <Flame className="h-4 w-4" />,
  1: <TrendingUp className="h-4 w-4" />,
  2: <TrendingUp className="h-4 w-4" />,
  3: <CheckCircle2 className="h-4 w-4" />,
  4: <Shield className="h-4 w-4" />,
};

interface DomainCardProps {
  domain: DomainWarmupStatus;
}

const DomainCard: React.FC<DomainCardProps> = ({ domain }) => {
  const stageColor = STAGE_COLORS[domain.warmup_stage] || STAGE_COLORS[0];
  const stageIcon = STAGE_ICONS[domain.warmup_stage] || STAGE_ICONS[0];

  const getWarningStyles = () => {
    if (domain.warning_level === 'critical') {
      return 'border-destructive/50 bg-destructive/5';
    }
    if (domain.warning_level === 'approaching') {
      return 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20';
    }
    return '';
  };

  const getProgressColor = () => {
    if (domain.usage_percent >= 90) return 'bg-destructive';
    if (domain.usage_percent >= 75) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <div className={cn("p-4 rounded-lg border space-y-4", getWarningStyles())}>
      {/* Domain Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{domain.domain_name}</span>
          {domain.is_entri_managed && (
            <Badge variant="secondary" className="text-xs">Auto-DNS</Badge>
          )}
        </div>
        <Badge className={cn("gap-1", stageColor)}>
          {stageIcon}
          {domain.stage_label}
        </Badge>
      </div>

      {/* Warning Banner */}
      {domain.warning_level !== 'none' && (
        <div className={cn(
          "flex items-center gap-2 p-2 rounded text-sm",
          domain.warning_level === 'critical' 
            ? "bg-destructive/10 text-destructive" 
            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
        )}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {domain.warning_level === 'critical'
              ? `Only ${domain.remaining_today} emails remaining today`
              : `Approaching daily limit (${domain.usage_percent}% used)`
            }
          </span>
        </div>
      )}

      {/* Today's Usage */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Today's Usage</span>
          <span className="font-medium">
            {domain.daily_sent.toLocaleString()} / {domain.daily_limit.toLocaleString()}
          </span>
        </div>
        <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-500", getProgressColor())}
            style={{ width: `${Math.min(100, domain.usage_percent)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{domain.remaining_today.toLocaleString()} remaining</span>
          <span>Resets at midnight UTC</span>
        </div>
      </div>

      {/* Stage Progress */}
      {domain.next_stage !== null && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Progress to Stage {domain.next_stage}
            </span>
            <span className="text-xs">
              {domain.healthy_days} / {domain.required_healthy_days} healthy days
            </span>
          </div>
          <Progress value={domain.stage_progress_percent} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            Next stage unlocks {domain.next_stage_limit?.toLocaleString()} emails/day
          </p>
        </div>
      )}

      {/* Stage Reason */}
      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        {domain.stage_reason}
      </p>

      {/* Health Metrics */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t">
        <div className="text-center">
          <div className="text-lg font-semibold">
            {(domain.open_rate_30d * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">Open Rate</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-lg font-semibold",
            domain.bounce_rate_30d > 0.02 && "text-destructive"
          )}>
            {(domain.bounce_rate_30d * 100).toFixed(2)}%
          </div>
          <div className="text-xs text-muted-foreground">Bounce</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-lg font-semibold",
            domain.complaint_rate_30d > 0.001 && "text-destructive"
          )}>
            {(domain.complaint_rate_30d * 100).toFixed(3)}%
          </div>
          <div className="text-xs text-muted-foreground">Complaint</div>
        </div>
      </div>
    </div>
  );
};

export const WarmupAssistantWidget: React.FC = () => {
  const { data, isLoading, error } = useWarmupStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null; // Silently fail if no warmup data
  }

  // If no custom domains, show a simplified message
  if (!data.has_custom_domain || data.domains.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Email Warmup
            </CardTitle>
            <WarmupInfoTooltip />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No custom email domain configured.</p>
            <p className="text-xs mt-1">Using shared sender (noreply@bloomsuite.email)</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Warmup Assistant
          </CardTitle>
          <WarmupInfoTooltip />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.domains.map((domain) => (
          <DomainCard key={domain.domain_id} domain={domain} />
        ))}
      </CardContent>
    </Card>
  );
};

const WarmupInfoTooltip: React.FC = () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs p-4">
        <div className="space-y-2">
          <p className="font-semibold">What is Email Warmup?</p>
          <p className="text-xs text-muted-foreground">
            New email domains need to build reputation with email providers (Gmail, Yahoo, etc.). 
            Sending too many emails too quickly can damage deliverability.
          </p>
          <p className="text-xs text-muted-foreground">
            The warmup process gradually increases your sending limits as your domain proves 
            it sends quality, wanted emails.
          </p>
          <div className="pt-2 border-t mt-2">
            <p className="text-xs font-medium">Warmup Stages:</p>
            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <li>• Stage 0: 50 emails/day (new)</li>
              <li>• Stage 1: 200 emails/day</li>
              <li>• Stage 2: 500 emails/day</li>
              <li>• Stage 3: 2,000 emails/day</li>
              <li>• Stage 4: Unlimited (fully warmed)</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Keep bounce rates below 2% and complaints below 0.1% to advance stages.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
