import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ListHealthMetrics {
  totalSent30d: number;
  bounceCount30d: number;
  complaintCount30d: number;
  bounceRate: number;
  complaintRate: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  suppressedCount: number;
  loading: boolean;
}

// Industry thresholds
const BOUNCE_RATE_WARNING = 2; // 2%
const BOUNCE_RATE_CRITICAL = 5; // 5%
const COMPLAINT_RATE_WARNING = 0.1; // 0.1%
const COMPLAINT_RATE_CRITICAL = 0.3; // 0.3%

export const useListHealth = (): ListHealthMetrics => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ListHealthMetrics>({
    totalSent30d: 0,
    bounceCount30d: 0,
    complaintCount30d: 0,
    bounceRate: 0,
    complaintRate: 0,
    healthStatus: 'healthy',
    suppressedCount: 0,
    loading: true,
  });

  const fetchMetrics = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get tenant ID
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userData?.tenant_id) return;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get event counts for last 30 days
      const { data: events, error: eventsError } = await supabase
        .from('email_tracking_events')
        .select('event_type, customer_email')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (eventsError) throw eventsError;

      // Count unique recipients by event type
      const sentEmails = new Set<string>();
      const bouncedEmails = new Set<string>();
      const complainedEmails = new Set<string>();

      (events || []).forEach(event => {
        if (event.event_type === 'sent') {
          sentEmails.add(event.customer_email);
        } else if (event.event_type === 'bounced' || event.event_type === 'bounce') {
          bouncedEmails.add(event.customer_email);
        } else if (event.event_type === 'complained' || event.event_type === 'complaint') {
          complainedEmails.add(event.customer_email);
        }
      });

      const totalSent = sentEmails.size;
      const bounceCount = bouncedEmails.size;
      const complaintCount = complainedEmails.size;

      const bounceRate = totalSent > 0 ? (bounceCount / totalSent) * 100 : 0;
      const complaintRate = totalSent > 0 ? (complaintCount / totalSent) * 100 : 0;

      // Get suppression count
      const { count: suppressedCount } = await supabase
        .from('suppression_list')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', userData.tenant_id);

      // Determine health status
      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (bounceRate >= BOUNCE_RATE_CRITICAL || complaintRate >= COMPLAINT_RATE_CRITICAL) {
        healthStatus = 'critical';
      } else if (bounceRate >= BOUNCE_RATE_WARNING || complaintRate >= COMPLAINT_RATE_WARNING) {
        healthStatus = 'warning';
      }

      setMetrics({
        totalSent30d: totalSent,
        bounceCount30d: bounceCount,
        complaintCount30d: complaintCount,
        bounceRate: Math.round(bounceRate * 100) / 100,
        complaintRate: Math.round(complaintRate * 1000) / 1000,
        healthStatus,
        suppressedCount: suppressedCount || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching list health:', error);
      setMetrics(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return metrics;
};
