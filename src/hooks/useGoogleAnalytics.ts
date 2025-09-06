import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GoogleAnalyticsData {
  overview: {
    totalSessions: number;
    totalPageviews: number;
    totalUsers: number;
    avgSessionDuration: number;
  };
  dailyData: Array<{
    date: string;
    sessions: number;
    pageviews: number;
    users: number;
  }>;
  topCountries: Array<{
    country: string;
    sessions: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    sessions: number;
  }>;
  trafficSources: Array<{
    source: string;
    sessions: number;
  }>;
}

export const useGoogleAnalytics = (propertyId?: string, dateRange: number = 30) => {
  const [data, setData] = useState<GoogleAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!propertyId) {
      setError('Property ID is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('ga-report-data', {
        body: {
          propertyId,
          dateRange
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch analytics data');
      }

      if (data?.success && data?.data) {
        setData(data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error: any) {
      console.error('Analytics fetch error:', error);
      setError(error.message || 'Failed to fetch analytics data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [propertyId, dateRange]);

  return {
    data,
    loading,
    error,
    refresh: fetchAnalytics
  };
};