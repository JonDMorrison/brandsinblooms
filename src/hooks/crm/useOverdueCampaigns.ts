import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OverdueCampaign {
  id: string;
  name: string;
  scheduled_at: string;
  send_attempts: number;
}

interface OverdueCampaignsData {
  overdueCount: number;
  oldestScheduledAt: string | null;
  campaigns: OverdueCampaign[];
}

interface UseOverdueCampaignsResult {
  data: OverdueCampaignsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useOverdueCampaigns = (pollInterval?: number): UseOverdueCampaignsResult => {
  const [data, setData] = useState<OverdueCampaignsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverdueCampaigns = useCallback(async () => {
    try {
      setError(null);
      
      const { data: result, error: rpcError } = await supabase.rpc('get_my_overdue_campaigns');

      if (rpcError) {
        console.error('Error fetching overdue campaigns:', rpcError);
        setError(rpcError.message);
        return;
      }

      if (result && result.length > 0) {
        const row = result[0];
        // Parse campaigns JSON safely
        let campaigns: OverdueCampaign[] = [];
        if (row.campaigns && Array.isArray(row.campaigns)) {
          campaigns = row.campaigns as unknown as OverdueCampaign[];
        } else if (typeof row.campaigns === 'string') {
          try {
            campaigns = JSON.parse(row.campaigns);
          } catch {
            campaigns = [];
          }
        }
        
        setData({
          overdueCount: Number(row.overdue_count) || 0,
          oldestScheduledAt: row.oldest_scheduled_at as string | null,
          campaigns
        });
      } else {
        setData({
          overdueCount: 0,
          oldestScheduledAt: null,
          campaigns: []
        });
      }
    } catch (err: any) {
      console.error('Error in useOverdueCampaigns:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverdueCampaigns();

    // Set up polling if interval provided
    if (pollInterval && pollInterval > 0) {
      const interval = setInterval(fetchOverdueCampaigns, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchOverdueCampaigns, pollInterval]);

  return {
    data,
    loading,
    error,
    refetch: fetchOverdueCampaigns
  };
};
