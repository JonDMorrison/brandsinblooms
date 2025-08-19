import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Crown, 
  UserPlus, 
  Mail, 
  MousePointer, 
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useSegmentCounts } from '@/hooks/useSegmentCounts';
import { usePersonaCustomerCounts } from '@/hooks/usePersonaCustomerCounts';
import { useCRMRealStats } from '@/hooks/useCRMRealStats';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  to: string;
  color?: string;
  loading?: boolean;
}

const StatCard = ({ title, value, subtitle, icon, to, color = 'text-primary', loading }: StatCardProps) => {
  if (loading) {
    return (
      <Card className="hover:shadow-md transition-all duration-200 cursor-pointer">
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-24"></div>
            <div className="h-8 bg-muted animate-pulse rounded w-16"></div>
            <div className="h-3 bg-muted animate-pulse rounded w-32"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <NavLink to={to} className="block">
      <Card className="hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-pointer group">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn("p-2 rounded-lg bg-muted/50", color)}>
                  {icon}
                </div>
                <h3 className="font-medium text-sm text-muted-foreground">{title}</h3>
              </div>
              
              <div className="text-3xl font-bold">{value.toLocaleString()}</div>
              
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
    </NavLink>
  );
};

export const CRMStatsCards = () => {
  const { counts: segmentCounts, loading: segmentsLoading } = useSegmentCounts();
  const { counts: personaCounts, loading: personasLoading } = usePersonaCustomerCounts();
  const { stats, loading: statsLoading } = useCRMRealStats();

  // Calculate totals
  const totalSegmentCustomers = Object.values(segmentCounts).reduce((sum, count) => sum + count, 0);
  const totalPersonaCustomers = Object.values(personaCounts).reduce((sum, count) => sum + count, 0);
  const totalSegments = Object.keys(segmentCounts).filter(key => segmentCounts[key] > 0).length;
  const totalPersonas = Object.keys(personaCounts).length;

  // Use real customer count from stats
  const totalCustomers = stats.totalCustomers || Math.max(totalSegmentCustomers, totalPersonaCustomers);

  // Get top segment and persona
  const topSegment = Object.entries(segmentCounts).reduce((max, [key, count]) => 
    count > max.count ? { name: key, count } : max, 
    { name: '', count: 0 }
  );
  
  const topPersona = Object.entries(personaCounts).reduce((max, [key, count]) => 
    count > max.count ? { name: key, count } : max, 
    { name: '', count: 0 }
  );

  const formatSegmentName = (segment: string) => {
    return segment.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      <StatCard
        title="Total Customers"
        value={totalCustomers}
        subtitle="Active customer base"
        icon={<Users className="w-5 h-5" />}
        to="/crm/customers"
        loading={segmentsLoading && personasLoading && statsLoading}
      />

      <StatCard
        title="Customer Segments"
        value={totalSegments}
        subtitle={totalSegmentCustomers > 0 ? `${totalSegmentCustomers.toLocaleString()} total customers` : 'No segments yet'}
        icon={<Crown className="w-5 h-5" />}
        to="/crm/segments"
        color="text-yellow-600"
        loading={segmentsLoading}
      />

      <StatCard
        title="Top Segment"
        value={topSegment.count}
        subtitle={topSegment.name ? formatSegmentName(topSegment.name) : 'No segments yet'}
        icon={<TrendingUp className="w-5 h-5" />}
        to="/crm/segments"
        color="text-green-600"
        loading={segmentsLoading}
      />

      <StatCard
        title="Customer Personas"
        value={totalPersonas}
        subtitle={totalPersonaCustomers > 0 ? `${totalPersonaCustomers.toLocaleString()} total customers` : 'No personas yet'}
        icon={<UserPlus className="w-5 h-5" />}
        to="/crm/personas"
        color="text-blue-600"
        loading={personasLoading}
      />

      <StatCard
        title="Average Open Rate"
        value={`${stats.avgOpenRate}%`}
        subtitle="Across all campaigns"
        icon={<Mail className="w-5 h-5" />}
        to="/crm/analytics"
        color="text-purple-600"
        loading={statsLoading}
      />

      <StatCard
        title="Average Click Rate"
        value={`${stats.avgClickRate}%`}
        subtitle="Email & SMS combined"
        icon={<MousePointer className="w-5 h-5" />}
        to="/crm/analytics"
        color="text-indigo-600"
        loading={statsLoading}
      />
    </div>
  );
};