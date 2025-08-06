import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HubAnalytics {
  totalViews: number;
  uniqueVisitors: number;
  interactions: {
    [key: string]: number;
  };
  topBlocks: Array<{
    block_id: string;
    interactions: number;
  }>;
  dailyViews: Array<{
    date: string;
    views: number;
  }>;
}

export const useHubAnalytics = (campaignId?: string, dateRange: number = 7) => {
  const [analytics, setAnalytics] = useState<HubAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    if (!campaignId) return;

    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - dateRange);

      // Get total views and unique visitors
      const { data: viewsData, error: viewsError } = await supabase
        .from('hub_views')
        .select('id, session_id, viewed_at')
        .eq('campaign_id', campaignId)
        .gte('viewed_at', startDate.toISOString())
        .lte('viewed_at', endDate.toISOString());

      if (viewsError) throw viewsError;

      const totalViews = viewsData?.length || 0;
      const uniqueVisitors = new Set(viewsData?.map(v => v.session_id)).size || 0;

      // Get interactions by type
      const { data: interactionsData, error: interactionsError } = await supabase
        .from('hub_interactions')
        .select('interaction_type, block_id')
        .eq('campaign_id', campaignId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (interactionsError) throw interactionsError;

      // Process interactions by type
      const interactions: { [key: string]: number } = {};
      const blockInteractions: { [key: string]: number } = {};

      interactionsData?.forEach(interaction => {
        interactions[interaction.interaction_type] = 
          (interactions[interaction.interaction_type] || 0) + 1;

        if (interaction.block_id) {
          blockInteractions[interaction.block_id] = 
            (blockInteractions[interaction.block_id] || 0) + 1;
        }
      });

      // Get top blocks
      const topBlocks = Object.entries(blockInteractions)
        .map(([block_id, interactions]) => ({ block_id, interactions }))
        .sort((a, b) => b.interactions - a.interactions)
        .slice(0, 5);

      // Get daily views
      const dailyViewsMap: { [key: string]: number } = {};
      viewsData?.forEach(view => {
        const date = new Date(view.viewed_at).toISOString().split('T')[0];
        dailyViewsMap[date] = (dailyViewsMap[date] || 0) + 1;
      });

      const dailyViews = Array.from({ length: dateRange }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (dateRange - 1 - i));
        const dateStr = date.toISOString().split('T')[0];
        return {
          date: dateStr,
          views: dailyViewsMap[dateStr] || 0
        };
      });

      setAnalytics({
        totalViews,
        uniqueVisitors,
        interactions,
        topBlocks,
        dailyViews
      });

    } catch (error) {
      console.error('Error fetching hub analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [campaignId, dateRange]);

  return {
    analytics,
    loading,
    refresh: fetchAnalytics
  };
};