import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export interface DerivedMetrics {
  totals: {
    sent: number;
    sent_events: number;
    observed_recipients: number;
    delivered: number;
    successful_reach: number;
    opens: number;
    clicks: number;
    bounces: number;
    hard_bounces: number;
    complaints: number;
    unsubscribes: number;
    opens_non_mpp: number;
    unique_engaged: number;
    skipped: number;
  };
  scores: {
    reach: number;
    interaction: number;
  };
  rates: {
    delivery: number;
    open_reported: number;
    open_adjusted: number;
    click: number;
    bounce: number;
    complaint: number;
    click_to_open: number;
  };
  diagnostics: {
    opens_without_delivery: number;
    clicks_without_delivery: number;
    missing_send_ledger: boolean;
  };
  reconciliation: {
    backfill_applied: boolean;
    backfilled_events: number;
    last_backfilled_at: string | null;
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

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeDerivedMetrics = (value: unknown): DerivedMetrics | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Record<string, any>;
  const totalsSource = candidate.totals && typeof candidate.totals === 'object'
    ? candidate.totals
    : candidate;
  const ratesSource = candidate.rates && typeof candidate.rates === 'object'
    ? candidate.rates
    : {};
  const scoresSource = candidate.scores && typeof candidate.scores === 'object'
    ? candidate.scores
    : {};
  const diagnosticsSource = candidate.diagnostics && typeof candidate.diagnostics === 'object'
    ? candidate.diagnostics
    : {};
  const reconciliationSource = candidate.reconciliation && typeof candidate.reconciliation === 'object'
    ? candidate.reconciliation
    : {};

  const sent = toNumber(totalsSource.sent ?? candidate.total_sent, 0);
  const delivered = toNumber(totalsSource.delivered, 0);
  const hardBounces = toNumber(
    totalsSource.hard_bounces ?? totalsSource.hardBounced ?? totalsSource.bounces ?? candidate.hard_bounces,
    0,
  );
  const opens = toNumber(totalsSource.opens ?? totalsSource.opened ?? candidate.total_opens, 0);
  const clicks = toNumber(totalsSource.clicks ?? totalsSource.clicked ?? candidate.total_clicks, 0);
  const opensNonMpp = toNumber(totalsSource.opens_non_mpp, 0);
  const successfulReach = toNumber(
    totalsSource.successful_reach,
    Math.max(delivered - hardBounces, 0),
  );
  const uniqueEngaged = toNumber(
    totalsSource.unique_engaged,
    Math.max(opens, clicks),
  );

  return {
    totals: {
      sent,
      sent_events: toNumber(totalsSource.sent_events, 0),
      observed_recipients: toNumber(totalsSource.observed_recipients, 0),
      delivered,
      successful_reach: successfulReach,
      opens,
      clicks,
      bounces: toNumber(totalsSource.bounces ?? totalsSource.bounced, 0),
      hard_bounces: hardBounces,
      complaints: toNumber(totalsSource.complaints ?? totalsSource.complained, 0),
      unsubscribes: toNumber(totalsSource.unsubscribes ?? totalsSource.unsubscribed, 0),
      opens_non_mpp: opensNonMpp,
      unique_engaged: uniqueEngaged,
      skipped: toNumber(totalsSource.skipped, 0),
    },
    scores: {
      reach: toNumber(
        scoresSource.reach,
        sent > 0 ? Number(((successfulReach / sent) * 100).toFixed(2)) : 0,
      ),
      interaction: toNumber(
        scoresSource.interaction,
        successfulReach > 0 ? Number(((uniqueEngaged / successfulReach) * 100).toFixed(2)) : 0,
      ),
    },
    rates: {
      delivery: toNumber(
        ratesSource.delivery,
        sent > 0 ? Number(((delivered / sent) * 100).toFixed(2)) : 0,
      ),
      open_reported: toNumber(
        ratesSource.open_reported,
        successfulReach > 0 ? Number(((opens / successfulReach) * 100).toFixed(2)) : 0,
      ),
      open_adjusted: toNumber(
        ratesSource.open_adjusted,
        successfulReach > 0 ? Number(((opensNonMpp / successfulReach) * 100).toFixed(2)) : 0,
      ),
      click: toNumber(
        ratesSource.click,
        successfulReach > 0 ? Number(((clicks / successfulReach) * 100).toFixed(2)) : 0,
      ),
      bounce: toNumber(
        ratesSource.bounce,
        sent > 0 ? Number(((hardBounces / sent) * 100).toFixed(2)) : 0,
      ),
      complaint: toNumber(ratesSource.complaint, 0),
      click_to_open: toNumber(
        ratesSource.click_to_open,
        opens > 0 ? Number(((clicks / opens) * 100).toFixed(2)) : 0,
      ),
    },
    diagnostics: {
      opens_without_delivery: toNumber(diagnosticsSource.opens_without_delivery, 0),
      clicks_without_delivery: toNumber(diagnosticsSource.clicks_without_delivery, 0),
      missing_send_ledger: Boolean(diagnosticsSource.missing_send_ledger),
    },
    reconciliation: {
      backfill_applied: Boolean(reconciliationSource.backfill_applied),
      backfilled_events: toNumber(reconciliationSource.backfilled_events, 0),
      last_backfilled_at: typeof reconciliationSource.last_backfilled_at === 'string'
        ? reconciliationSource.last_backfilled_at
        : null,
    },
    links: Array.isArray(candidate.links)
      ? candidate.links.map((link: any) => ({
          link_id: typeof link?.link_id === 'string' ? link.link_id : 'unknown',
          url: typeof link?.url === 'string' ? link.url : 'Unknown',
          clicks: toNumber(link?.clicks, 0),
        }))
      : [],
    computed_at: typeof candidate.computed_at === 'string'
      ? candidate.computed_at
      : new Date().toISOString(),
  };
};

export const useCampaignDerivedMetrics = (campaignId: string | undefined): UseCampaignDerivedMetricsResult => {
  const [metrics, setMetrics] = useState<DerivedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [rollupRefreshedAt, setRollupRefreshedAt] = useState<Date | null>(null);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  const lastEventStateUpdateAtMsRef = useRef<number>(0);

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
        setMetrics(normalizeDerivedMetrics(campaign.metrics));
      }

      if (campaign?.rollup_refreshed_at) {
        setRollupRefreshedAt(new Date(campaign.rollup_refreshed_at));
      }

      if (latestEvent?.created_at) {
        setLastEventAt(new Date(latestEvent.created_at));
      }

      setLastRefreshed(new Date());
    } catch (err: unknown) {
      console.error('Error fetching derived metrics:', err);
      setError(getErrorMessage(err));
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
        setMetrics(normalizeDerivedMetrics(data));
        setRollupRefreshedAt(new Date());
        setLastRefreshed(new Date());
        toast.success('Metrics recalculated');
      }
    } catch (err: unknown) {
      console.error('Error recomputing metrics:', err);
      toast.error('Failed to recalculate metrics');
      setError(getErrorMessage(err));
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
          if (import.meta.env.DEV) {
            console.debug('New tracking event:', payload);
          }
          // Avoid rerendering this metrics card for every single tracking insert.
          const nowMs = Date.now();
          if (nowMs - lastEventStateUpdateAtMsRef.current >= 5000) {
            lastEventStateUpdateAtMsRef.current = nowMs;
            setLastEventAt(new Date());
          }
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
