import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EmailCampaignSummary {
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  totalUnsubscribes: number;
  avgOpenRate: number;
  avgClickRate: number;
  campaignCount: number;
  loading: boolean;
}

export const useEmailCampaignSummary = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<EmailCampaignSummary>({
    totalSent: 0,
    totalOpens: 0,
    totalClicks: 0,
    totalUnsubscribes: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
    campaignCount: 0,
    loading: true,
  });

  const loadSummary = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get tenant ID
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userData?.tenant_id) return;

      // Get all sent campaigns with metrics
      const { data: campaigns, error } = await supabase
        .from('crm_campaigns')
        .select('total_sent, total_opens, total_clicks, open_rate, click_rate, metrics')
        .eq('tenant_id', userData.tenant_id)
        .eq('status', 'sent');

      if (error) throw error;

      if (!campaigns || campaigns.length === 0) {
        setSummary(prev => ({ ...prev, loading: false }));
        return;
      }

      // Calculate aggregates
      let totalSent = 0;
      let totalOpens = 0;
      let totalClicks = 0;
      let totalUnsubscribes = 0;
      let weightedOpenRate = 0;
      let weightedClickRate = 0;

      campaigns.forEach(campaign => {
        const sent = campaign.total_sent || 0;
        totalSent += sent;
        totalOpens += campaign.total_opens || 0;
        totalClicks += campaign.total_clicks || 0;
        
        // Extract unsubscribes from metrics JSON
        const metrics = campaign.metrics as Record<string, any> | null;
        if (metrics && typeof metrics === 'object') {
          totalUnsubscribes += metrics.unsubscribed || 0;
        }

        // Weight rates by volume
        weightedOpenRate += (campaign.open_rate || 0) * sent;
        weightedClickRate += (campaign.click_rate || 0) * sent;
      });

      const avgOpenRate = totalSent > 0 ? weightedOpenRate / totalSent : 0;
      const avgClickRate = totalSent > 0 ? weightedClickRate / totalSent : 0;

      setSummary({
        totalSent,
        totalOpens,
        totalClicks,
        totalUnsubscribes,
        avgOpenRate,
        avgClickRate,
        campaignCount: campaigns.length,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading email campaign summary:', error);
      setSummary(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return { ...summary, refetch: loadSummary };
};
