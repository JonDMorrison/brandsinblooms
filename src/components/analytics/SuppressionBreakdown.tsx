import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Ban, AlertTriangle, Mail } from 'lucide-react';

interface SuppressionBreakdownProps {
  compact?: boolean;
}

interface ReasonCount {
  reason: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}

export const SuppressionBreakdown: React.FC<SuppressionBreakdownProps> = ({ compact = false }) => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['suppression-breakdown', user?.id],
    queryFn: async () => {
      // Get tenant ID
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id || '')
        .single();

      if (!userData?.tenant_id) return null;

      // Get counts by reason
      const { data: suppressions, error } = await supabase
        .from('suppression_list')
        .select('reason')
        .eq('tenant_id', userData.tenant_id);

      if (error) throw error;

      // Count by reason
      const counts: Record<string, number> = {};
      (suppressions || []).forEach(s => {
        counts[s.reason] = (counts[s.reason] || 0) + 1;
      });

      return {
        unsubscribed: counts['unsubscribed'] || 0,
        bounced: counts['bounced'] || 0,
        complaint: counts['complaint'] || 0,
        total: (suppressions || []).length,
      };
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (!data) {
    return null;
  }

  const reasons: ReasonCount[] = [
    {
      reason: 'Unsubscribed',
      count: data.unsubscribed,
      icon: <Mail className="h-3 w-3" />,
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    {
      reason: 'Bounced',
      count: data.bounced,
      icon: <Ban className="h-3 w-3" />,
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    },
    {
      reason: 'Complained',
      count: data.complaint,
      icon: <AlertTriangle className="h-3 w-3" />,
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {reasons.map(r => (
          r.count > 0 && (
            <Badge key={r.reason} variant="secondary" className={`${r.color} text-xs`}>
              {r.icon}
              <span className="ml-1">{r.reason}: {r.count}</span>
            </Badge>
          )
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {reasons.map(r => (
        <div key={r.reason} className="p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
            {r.icon}
            <span>{r.reason}</span>
          </div>
          <p className="text-lg font-bold">{r.count}</p>
        </div>
      ))}
    </div>
  );
};

export default SuppressionBreakdown;
