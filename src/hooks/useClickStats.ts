/**
 * Hook for fetching email click statistics
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClickStats {
  totalClicks: number;
  uniqueClicks: number;
  topLinks: Array<{ url: string; clicks: number }>;
  clicksByDay: Array<{ date: string; clicks: number }>;
}

export function useCampaignClickStats(campaignId: string | null | undefined) {
  return useQuery({
    queryKey: ['campaign-click-stats', campaignId],
    queryFn: async (): Promise<ClickStats> => {
      if (!campaignId) {
        return { totalClicks: 0, uniqueClicks: 0, topLinks: [], clicksByDay: [] };
      }

      // Get all tracked links for this campaign
      const { data: links, error: linksError } = await supabase
        .from('email_tracked_links')
        .select('id, original_url')
        .eq('campaign_id', campaignId);

      if (linksError || !links?.length) {
        return { totalClicks: 0, uniqueClicks: 0, topLinks: [], clicksByDay: [] };
      }

      const linkIds = links.map(l => l.id);

      // Get click events
      const { data: clicks, error: clicksError } = await supabase
        .from('email_click_events')
        .select('id, tracked_link_id, customer_id, clicked_at')
        .in('tracked_link_id', linkIds);

      if (clicksError || !clicks) {
        return { totalClicks: 0, uniqueClicks: 0, topLinks: [], clicksByDay: [] };
      }

      // Calculate stats
      const totalClicks = clicks.length;

      // Unique clicks = distinct (customer_id, tracked_link_id) pairs
      const uniquePairs = new Set(
        clicks.map(c => `${c.customer_id || 'anon'}-${c.tracked_link_id}`)
      );
      const uniqueClicks = uniquePairs.size;

      // Top links by click count
      const clicksByLink = new Map<string, number>();
      for (const click of clicks) {
        const link = links.find(l => l.id === click.tracked_link_id);
        if (link) {
          clicksByLink.set(link.original_url, (clicksByLink.get(link.original_url) || 0) + 1);
        }
      }

      const topLinks = Array.from(clicksByLink.entries())
        .map(([url, clicks]) => ({ url, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      // Clicks by day
      const clicksByDayMap = new Map<string, number>();
      for (const click of clicks) {
        const date = new Date(click.clicked_at).toISOString().split('T')[0];
        clicksByDayMap.set(date, (clicksByDayMap.get(date) || 0) + 1);
      }

      const clicksByDay = Array.from(clicksByDayMap.entries())
        .map(([date, clicks]) => ({ date, clicks }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totalClicks, uniqueClicks, topLinks, clicksByDay };
    },
    enabled: !!campaignId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useAutomationClickStats(automationId: string | null | undefined) {
  return useQuery({
    queryKey: ['automation-click-stats', automationId],
    queryFn: async (): Promise<ClickStats> => {
      if (!automationId) {
        return { totalClicks: 0, uniqueClicks: 0, topLinks: [], clicksByDay: [] };
      }

      // Get all tracked links for this automation
      const { data: links, error: linksError } = await supabase
        .from('email_tracked_links')
        .select('id, original_url')
        .eq('automation_id', automationId);

      if (linksError || !links?.length) {
        return { totalClicks: 0, uniqueClicks: 0, topLinks: [], clicksByDay: [] };
      }

      const linkIds = links.map(l => l.id);

      // Get click events
      const { data: clicks, error: clicksError } = await supabase
        .from('email_click_events')
        .select('id, tracked_link_id, customer_id, clicked_at')
        .in('tracked_link_id', linkIds);

      if (clicksError || !clicks) {
        return { totalClicks: 0, uniqueClicks: 0, topLinks: [], clicksByDay: [] };
      }

      const totalClicks = clicks.length;
      const uniquePairs = new Set(
        clicks.map(c => `${c.customer_id || 'anon'}-${c.tracked_link_id}`)
      );
      const uniqueClicks = uniquePairs.size;

      const clicksByLink = new Map<string, number>();
      for (const click of clicks) {
        const link = links.find(l => l.id === click.tracked_link_id);
        if (link) {
          clicksByLink.set(link.original_url, (clicksByLink.get(link.original_url) || 0) + 1);
        }
      }

      const topLinks = Array.from(clicksByLink.entries())
        .map(([url, clicks]) => ({ url, clicks }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      const clicksByDayMap = new Map<string, number>();
      for (const click of clicks) {
        const date = new Date(click.clicked_at).toISOString().split('T')[0];
        clicksByDayMap.set(date, (clicksByDayMap.get(date) || 0) + 1);
      }

      const clicksByDay = Array.from(clicksByDayMap.entries())
        .map(([date, clicks]) => ({ date, clicks }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { totalClicks, uniqueClicks, topLinks, clicksByDay };
    },
    enabled: !!automationId,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
