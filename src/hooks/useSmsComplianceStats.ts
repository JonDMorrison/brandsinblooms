import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SmsComplianceStats {
  totalEvents: number;
  stopCount: number;
  startCount: number;
  helpCount: number;
  a2pErrors: number;
  carrierFiltering: number;
  invalidNumbers: number;
  spamDetection: number;
  contentRejection: number;
  optOutRate: number;
}

interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

export const useSmsComplianceStats = (dateRange?: DateRange) => {
  const [stats, setStats] = useState<SmsComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userData?.tenant_id) {
        throw new Error('No tenant found');
      }

      // Build query
      let query = supabase
        .from('sms_compliance_events')
        .select('event_type, created_at')
        .eq('tenant_id', userData.tenant_id);

      if (dateRange?.startDate) {
        query = query.gte('created_at', dateRange.startDate.toISOString());
      }
      if (dateRange?.endDate) {
        query = query.lte('created_at', dateRange.endDate.toISOString());
      }

      const { data: events, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Calculate stats
      const eventList = events || [];
      const stopCount = eventList.filter(e => e.event_type === 'STOP').length;
      const startCount = eventList.filter(e => e.event_type === 'START').length;
      const helpCount = eventList.filter(e => e.event_type === 'HELP').length;
      const a2pErrors = eventList.filter(e => e.event_type === 'A2P_10DLC_ERROR').length;
      const carrierFiltering = eventList.filter(e => e.event_type === 'CARRIER_FILTERING').length;
      const invalidNumbers = eventList.filter(e => e.event_type === 'INVALID_NUMBER').length;
      const spamDetection = eventList.filter(e => e.event_type === 'SPAM_DETECTION').length;
      const contentRejection = eventList.filter(e => e.event_type === 'CONTENT_REJECTION').length;

      // Calculate opt-out rate (simple approximation based on events)
      const optOutRate = startCount > 0 
        ? ((stopCount - startCount) / (stopCount + startCount)) * 100 
        : stopCount > 0 ? 100 : 0;

      setStats({
        totalEvents: eventList.length,
        stopCount,
        startCount,
        helpCount,
        a2pErrors,
        carrierFiltering,
        invalidNumbers,
        spamDetection,
        contentRejection,
        optOutRate,
      });
    } catch (err) {
      console.error('Failed to fetch SMS compliance stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange?.startDate, dateRange?.endDate]);

  return { stats, loading, error, refetch: fetchStats };
};
