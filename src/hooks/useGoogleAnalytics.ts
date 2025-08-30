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
      setError('Google Analytics Property ID not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - dateRange);

      const { data: result, error: functionError } = await supabase.functions.invoke('google-analytics', {
        body: {
          propertyId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          metrics: ['sessions', 'pageviews', 'users', 'averageSessionDuration']
        }
      });

      if (functionError) throw functionError;

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch analytics data');
      }
    } catch (error) {
      console.error('Error fetching Google Analytics:', error);
      setError(error.message || 'Failed to fetch analytics data');
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