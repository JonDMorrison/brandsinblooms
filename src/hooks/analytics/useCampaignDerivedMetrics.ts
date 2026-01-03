import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DerivedMetrics {
  totals: {
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    bounces: number;
    complaints: number;
    unsubscribes: number;
    opens_non_mpp: number;
  };
  rates: {
    open_reported: number;
    open_adjusted: number;
    click: number;
    bounce: number;
    complaint: number;
  };
  links: Array<{
    link_id: string;
    url: string;
    clicks: number;
  }>;
  computed_at: string;
}

interface UseCampaignDerivedMetricsResult {
  metrics: DerivedMetrics | null;
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  isStale: boolean;
  recompute: () => Promise<void>;
  refresh: () => Promise<void>;
}

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export const useCampaignDerivedMetrics = (campaignId: string | undefined): UseCampaignDerivedMetricsResult => {
  const [metrics, setMetrics] = useState<DerivedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [rollupRefreshedAt, setRollupRefreshedAt] = useState<Date | null>(null);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  // Check if data is stale (rollup older than last event by threshold)
  const isStale = (() => {
    if (!rollupRefreshedAt || !lastEventAt) return false;
    return lastEventAt.getTime() - rollupRefreshedAt.getTime() > STALE_THRESHOLD_MS;
  })();

  const fetchMetrics = useCallback(async () => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch campaign with metrics
      const { data: campaign, error: campaignError } = await supabase
        .from('crm_campaigns')
        .select('metrics, rollup_refreshed_at')
        .eq('id', campaignId)
        .single();

      if (campaignError) throw campaignError;

      // Get latest event timestamp to check staleness
      const { data: latestEvent } = await supabase
        .from('email_tracking_events')
        .select('created_at')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (campaign?.metrics && typeof campaign.metrics === 'object') {
        const metricsData = campaign.metrics as unknown as DerivedMetrics;
        setMetrics(metricsData);
      }

      if (campaign?.rollup_refreshed_at) {
        setRollupRefreshedAt(new Date(campaign.rollup_refreshed_at));
      }

      if (latestEvent?.created_at) {
        setLastEventAt(new Date(latestEvent.created_at));
      }

      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Error fetching derived metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const recompute = useCallback(async () => {
    if (!campaignId) return;

    try {
      setLoading(true);
      
      const { data, error: rpcError } = await supabase.rpc('recompute_campaign_metrics', {
        p_campaign_id: campaignId
      });

      if (rpcError) throw rpcError;

      if (data) {
        setMetrics(data as unknown as DerivedMetrics);
        setRollupRefreshedAt(new Date());
        setLastRefreshed(new Date());
        toast.success('Metrics recalculated');
      }
    } catch (err: any) {
      console.error('Error recomputing metrics:', err);
      toast.error('Failed to recalculate metrics');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Real-time subscription for new events
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`campaign-events-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_tracking_events',
          filter: `campaign_id=eq.${campaignId}`
        },
        (payload) => {
          console.log('New tracking event:', payload);
          setLastEventAt(new Date());
          // Debounced refresh could be added here
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return {
    metrics,
    loading,
    error,
    lastRefreshed,
    isStale,
    recompute,
    refresh: fetchMetrics
  };
};
