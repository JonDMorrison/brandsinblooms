import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui-legacy/avatar';
import { Badge } from '@/components/ui-legacy/badge';
import { RadialGauge } from '@/components/ui-legacy/radial-gauge';
import { Sparkline } from '@/components/ui-legacy/sparkline';
import { Mail, Phone, MessageSquare, Calendar, MapPin } from 'lucide-react';

interface CustomerSnapshotProps {
  customer: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
    lifecycle_stage?: string;
    created_at?: string;
  };
  metrics: {
    engagementHealthScore?: number;
    engagementTrend?: number[];
    intentScore?: number;
    intentLevel?: string;
    preferredChannel?: string;
    accountAgeDays?: number;
  };
  className?: string;
}

const lifecycleColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  loyal: 'bg-purple-100 text-purple-700 border-purple-200',
  'at-risk': 'bg-amber-100 text-amber-700 border-amber-200',
  dormant: 'bg-gray-100 text-gray-600 border-gray-200',
  churned: 'bg-red-100 text-red-700 border-red-200',
  reactivated: 'bg-teal-100 text-teal-700 border-teal-200',
};

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
};

const formatAccountAge = (days: number): string => {
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months > 0 ? `${years}y ${months}m` : `${years} year${years > 1 ? 's' : ''}`;
};

export const CustomerSnapshot: React.FC<CustomerSnapshotProps> = ({
  customer,
  metrics,
  className,
}) => {
  const initials = customer.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const lifecycleClass = lifecycleColors[customer.lifecycle_stage?.toLowerCase() || 'new'] || lifecycleColors.new;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 sm:p-6', className)}>
      {/* Top row: Avatar, name, contact */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <Avatar className="h-16 w-16 border-2 border-border">
          <AvatarImage src={customer.avatar_url} alt={customer.name} />
          <AvatarFallback className="text-lg font-semibold bg-muted">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl font-semibold text-foreground truncate">
              {customer.name || 'Unknown Customer'}
            </h2>
            <Badge variant="outline" className={cn('text-xs', lifecycleClass)}>
              {customer.lifecycle_stage || 'New'}
            </Badge>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {customer.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate max-w-[200px]">{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                <span>{customer.phone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Engagement Health */}
        <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
          <RadialGauge
            value={metrics.engagementHealthScore || 0}
            size="sm"
            variant="health"
            label="Health"
          />
          {metrics.engagementTrend && metrics.engagementTrend.length > 1 && (
            <Sparkline 
              data={metrics.engagementTrend} 
              width={48} 
              height={16}
              className="mt-1"
            />
          )}
        </div>

        {/* Intent Score */}
        <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
          <RadialGauge
            value={metrics.intentScore || 0}
            size="sm"
            variant="intent"
            label="Intent"
          />
          <span className="text-[10px] text-muted-foreground mt-1 capitalize">
            {metrics.intentLevel || 'Unknown'}
          </span>
        </div>

        {/* Preferred Channel */}
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted/30">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
            {channelIcons[metrics.preferredChannel?.toLowerCase() || 'email'] || channelIcons.email}
          </div>
          <span className="text-xs font-medium text-foreground capitalize">
            {metrics.preferredChannel || 'Email'}
          </span>
          <span className="text-[10px] text-muted-foreground">Preferred</span>
        </div>

        {/* Account Age */}
        <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-muted/30">
          <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-1">
            <Calendar className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-foreground">
            {formatAccountAge(metrics.accountAgeDays || 0)}
          </span>
          <span className="text-[10px] text-muted-foreground">Account Age</span>
        </div>

        {/* Quick Stats */}
        <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-3 rounded-lg bg-muted/30">
          <div className="text-2xl font-bold text-foreground">
            {metrics.engagementHealthScore || 0}
          </div>
          <span className="text-[10px] text-muted-foreground text-center">
            Overall Score
          </span>
        </div>
      </div>
    </div>
  );
};

export default CustomerSnapshot;
