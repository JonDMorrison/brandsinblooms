import { useDeliverabilityStatus, DeliverabilityStatus, DeliverabilityWarning } from '@/hooks/useDeliverabilityStatus';
import { useDomainStats } from '@/hooks/useDomainStats';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  TrendingDown,
  TrendingUp,
  Minus,
  Mail,
  MousePointerClick,
  AlertCircle,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DeliverabilityMonitorProps {
  tenantId?: string;
}

const StatusLight = ({ status }: { status: 'healthy' | 'warning' | 'critical' }) => {
  const config = {
    healthy: { color: 'bg-green-500', shadow: 'shadow-green-500/50', label: 'Healthy' },
    warning: { color: 'bg-amber-500', shadow: 'shadow-amber-500/50', label: 'Warning' },
    critical: { color: 'bg-red-500', shadow: 'shadow-red-500/50', label: 'Critical' },
  }[status];

  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        'w-4 h-4 rounded-full animate-pulse shadow-lg',
        config.color,
        config.shadow
      )} />
      <span className="font-semibold text-lg">{config.label}</span>
    </div>
  );
};

const MetricCard = ({ 
  label, 
  value, 
  icon: Icon, 
  trend,
  suffix = '',
  status = 'neutral'
}: { 
  label: string; 
  value: number | string; 
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  suffix?: string;
  status?: 'good' | 'warning' | 'danger' | 'neutral';
}) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const statusColors = {
    good: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    neutral: 'text-foreground',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="p-2 rounded-md bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <span className={cn('text-lg font-semibold', statusColors[status])}>
            {value}{suffix}
          </span>
          {trend && trend !== 'neutral' && (
            <TrendIcon className={cn(
              'h-4 w-4',
              trend === 'up' ? 'text-green-500' : 'text-red-500'
            )} />
          )}
        </div>
      </div>
    </div>
  );
};

const WarningCard = ({ warning }: { warning: DeliverabilityWarning }) => {
  const Icon = warning.severity === 'critical' ? XCircle : AlertTriangle;
  
  return (
    <Alert variant={warning.severity === 'critical' ? 'destructive' : 'default'} className={cn(
      warning.severity === 'warning' && 'border-amber-500 bg-amber-50 text-amber-900'
    )}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="capitalize">{warning.type.replace('_', ' ')}</AlertTitle>
      <AlertDescription>{warning.message}</AlertDescription>
    </Alert>
  );
};

const TrendChart = ({ data }: { data: DeliverabilityStatus }) => {
  const chartData = data.trend.recent_open_rates
    .filter((rate): rate is number => rate !== null)
    .map((rate, index) => ({
      campaign: `Campaign ${3 - index}`,
      openRate: rate,
    }))
    .reverse();

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <p>Not enough campaign data for trend analysis</p>
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="campaign" className="text-xs" />
          <YAxis domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} className="text-xs" />
          <Tooltip 
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Open Rate']}
            contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
          />
          <Line 
            type="monotone" 
            dataKey="openRate" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const DeliverabilityDetails = ({ data }: { data: DeliverabilityStatus }) => {
  const getBounceStatus = (rate: number) => {
    if (rate <= 2) return 'good';
    if (rate <= 5) return 'warning';
    return 'danger';
  };

  const getComplaintStatus = (rate: number) => {
    if (rate <= 0.1) return 'good';
    if (rate <= 0.2) return 'warning';
    return 'danger';
  };

  return (
    <div className="space-y-6">
      {/* Traffic Light Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {data.domain_name}
              </CardTitle>
              <CardDescription>
                {data.recommendation}
              </CardDescription>
            </div>
            <StatusLight status={data.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard 
              label="Open Rate" 
              value={data.rates.open_rate} 
              suffix="%" 
              icon={Mail}
              trend={data.trend.declining ? 'down' : 'neutral'}
              status={data.rates.open_rate >= 20 ? 'good' : data.rates.open_rate >= 10 ? 'warning' : 'danger'}
            />
            <MetricCard 
              label="Click Rate" 
              value={data.rates.click_rate} 
              suffix="%" 
              icon={MousePointerClick}
              status={data.rates.click_rate >= 2 ? 'good' : 'neutral'}
            />
            <MetricCard 
              label="Bounce Rate" 
              value={data.rates.bounce_rate} 
              suffix="%" 
              icon={AlertCircle}
              status={getBounceStatus(data.rates.bounce_rate)}
            />
            <MetricCard 
              label="Complaint Rate" 
              value={data.rates.complaint_rate} 
              suffix="%" 
              icon={XCircle}
              status={getComplaintStatus(data.rates.complaint_rate)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">Active Warnings</h4>
          {data.warnings.map((warning, index) => (
            <WarningCard key={index} warning={warning} />
          ))}
        </div>
      )}

      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Open Rate Trend
            {data.trend.declining && (
              <Badge variant="destructive" className="text-xs">Declining</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={data} />
        </CardContent>
      </Card>

      {/* Volume Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">30-Day Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold">{data.metrics.sent_30d.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{data.metrics.delivered_30d.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{data.metrics.opened_30d.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Opened</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{data.metrics.clicked_30d.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Clicked</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{data.metrics.bounced_30d.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Bounced</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{data.metrics.complained_30d.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Complained</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const DeliverabilityMonitor = ({ tenantId }: DeliverabilityMonitorProps) => {
  const [selectedDomainId, setSelectedDomainId] = useState<string | undefined>();
  const { data: domains, isLoading: loadingDomains } = useDomainStats(tenantId);
  const { data: deliverabilityData, isLoading: loadingStatus, error } = useDeliverabilityStatus(selectedDomainId);

  if (loadingDomains) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deliverability Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deliverability Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span>No sending domains configured</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Deliverability Monitor</CardTitle>
          <CardDescription>
            Monitor domain reputation, track delivery metrics, and get actionable warnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedDomainId || ''}
            onChange={(e) => setSelectedDomainId(e.target.value || undefined)}
            className="w-full md:w-64 h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a domain to analyze</option>
            {domains.map((domain) => (
              <option key={domain.domain_id} value={domain.domain_id}>
                {domain.domain_name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {loadingStatus && selectedDomainId && (
        <Card>
          <CardContent className="p-8">
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load deliverability status</AlertDescription>
        </Alert>
      )}

      {deliverabilityData && <DeliverabilityDetails data={deliverabilityData} />}
    </div>
  );
};
