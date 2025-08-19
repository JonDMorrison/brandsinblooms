import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AnalyticsOverview {
  totalViews: number;
  engagementRate: number;
  clicks: number;
  conversions: number;
  growth: number;
  loading: boolean;
  error: string | null;
}

export const useAnalyticsOverview = (days: number = 30) => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview>({
    totalViews: 0,
    engagementRate: 0,
    clicks: 0,
    conversions: 0,
    growth: 0,
    loading: true,
    error: null
  });

  const fetchOverview = async () => {
    if (!user) return;

    try {
      setOverview(prev => ({ ...prev, loading: true, error: null }));
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateIso = startDate.toISOString();

      const prevStartDate = new Date();
      prevStartDate.setDate(prevStartDate.getDate() - (days * 2));
      const prevEndDate = new Date();
      prevEndDate.setDate(prevEndDate.getDate() - days);

      // Get total views from multiple sources
      const [
        hubViewsResult,
        analyticsDataResult,
        postPerformanceResult,
        analyticsEventsResult,
        prevAnalyticsDataResult,
        prevPostPerformanceResult
      ] = await Promise.all([
        // Hub views (campaign landing pages)
        supabase
          .from('hub_views')
          .select('id, campaign_id')
          .gte('viewed_at', startDateIso),
        
        // Social media analytics data (impressions, reach)
        supabase
          .from('analytics_data')
          .select('metric_type, metric_value, date_collected')
          .gte('date_collected', startDateIso)
          .in('metric_type', ['impressions', 'reach', 'views']),
          
        // Post performance data
        supabase
          .from('post_performance')
          .select('impressions, reach, likes_count, comments_count, shares_count, engagement_rate')
          .gte('collected_at', startDateIso),
          
        // Analytics events (clicks, conversions)
        supabase
          .from('analytics_events')
          .select('event_type, payload')
          .gte('created_at', startDateIso),
          
        // Previous period analytics data for growth calculation
        supabase
          .from('analytics_data')
          .select('metric_type, metric_value, date_collected')
          .gte('date_collected', prevStartDate.toISOString())
          .lt('date_collected', prevEndDate.toISOString())
          .in('metric_type', ['impressions', 'reach', 'views']),
          
        // Previous period post performance
        supabase
          .from('post_performance')
          .select('impressions, reach, likes_count, comments_count, shares_count')
          .gte('collected_at', prevStartDate.toISOString())
          .lt('collected_at', prevEndDate.toISOString())
      ]);

      // Calculate total views/impressions
      let totalViews = 0;
      let totalEngagement = 0;
      let totalImpressions = 0;

      // Hub views
      totalViews += hubViewsResult.data?.length || 0;

      // Analytics data (social media impressions/reach)
      if (analyticsDataResult.data) {
        const impressionsSum = analyticsDataResult.data
          .filter(d => d.metric_type === 'impressions' || d.metric_type === 'reach' || d.metric_type === 'views')
          .reduce((sum, d) => sum + d.metric_value, 0);
        totalViews += impressionsSum;
      }

      // Post performance impressions
      if (postPerformanceResult.data) {
        const postImpressions = postPerformanceResult.data.reduce((sum, p) => sum + (p.impressions || 0), 0);
        const postEngagement = postPerformanceResult.data.reduce((sum, p) => 
          sum + (p.likes_count || 0) + (p.comments_count || 0) + (p.shares_count || 0), 0);
        totalViews += postImpressions;
        totalEngagement += postEngagement;
        totalImpressions += postImpressions;
      }

      // Calculate engagement rate
      const engagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;

      // Calculate clicks from analytics events
      const clicks = analyticsEventsResult.data?.filter(e => e.event_type === 'link_click').length || 0;

      // Calculate conversions (coupon redemptions, purchase events)
      const conversions = analyticsEventsResult.data?.filter(e => 
        e.event_type === 'coupon_redeem' || e.event_type === 'share_click'
      ).length || 0;

      // Calculate growth compared to previous period
      let prevTotalViews = 0;
      if (prevAnalyticsDataResult.data) {
        prevTotalViews += prevAnalyticsDataResult.data
          .filter(d => d.metric_type === 'impressions' || d.metric_type === 'reach' || d.metric_type === 'views')
          .reduce((sum, d) => sum + d.metric_value, 0);
      }
      if (prevPostPerformanceResult.data) {
        prevTotalViews += prevPostPerformanceResult.data.reduce((sum, p) => sum + (p.impressions || 0), 0);
      }

      const growth = prevTotalViews > 0 ? 
        Math.round(((totalViews - prevTotalViews) / prevTotalViews) * 100) : 0;

      setOverview({
        totalViews: Math.round(totalViews),
        engagementRate: Math.round(engagementRate * 100) / 100,
        clicks,
        conversions,
        growth,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      setOverview(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics'
      }));
    }
  };

  useEffect(() => {
    if (user) {
      fetchOverview();
    }
  }, [user, days]);

  return { ...overview, refetch: fetchOverview };
};