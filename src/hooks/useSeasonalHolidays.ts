import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Holiday {
  id: string;
  holiday_name: string;
  category: string;
  holiday_date: string;
  description: string;
  garden_relevance: string;
  is_active: boolean;
}

export const useSeasonalHolidays = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpcomingHolidays = async () => {
    if (!user) {
      setHolidays([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching holidays for upcoming opportunities');

      const today = new Date();
      
      // First check for holidays in the next 60 days (2 months)
      const twoMonthsDate = new Date();
      twoMonthsDate.setDate(today.getDate() + 60);
      
      const todayStr = today.toISOString().split('T')[0];
      const twoMonthsStr = twoMonthsDate.toISOString().split('T')[0];

      console.log('Checking 2-month range:', todayStr, 'to', twoMonthsStr);

      const { data: twoMonthData, error: twoMonthError } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_active', true)
        .gte('holiday_date', todayStr)
        .lte('holiday_date', twoMonthsStr)
        .order('holiday_date', { ascending: true });

      if (twoMonthError) {
        console.error('Error fetching 2-month holidays:', twoMonthError);
        setError(twoMonthError.message);
        setHolidays([]);
        return;
      }

      console.log('2-month holidays found:', twoMonthData?.length || 0);

      // If there are exactly 8 opportunities in 2 months, show all 8
      if (twoMonthData && twoMonthData.length === 8) {
        console.log('Showing all 8 holidays from 2-month period');
        setHolidays(twoMonthData);
        return;
      }

      // Otherwise, fetch up to 6 holidays from 90-day range
      const threeMonthsDate = new Date();
      threeMonthsDate.setDate(today.getDate() + 90);
      const threeMonthsStr = threeMonthsDate.toISOString().split('T')[0];

      console.log('Fetching 6 holidays from 3-month range:', todayStr, 'to', threeMonthsStr);

      const { data: threeMonthData, error: threeMonthError } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_active', true)
        .gte('holiday_date', todayStr)
        .lte('holiday_date', threeMonthsStr)
        .order('holiday_date', { ascending: true })
        .limit(6);

      if (threeMonthError) {
        console.error('Error fetching 3-month holidays:', threeMonthError);
        setError(threeMonthError.message);
        setHolidays([]);
      } else {
        console.log('Showing', threeMonthData?.length || 0, 'holidays from 3-month period');
        setHolidays(threeMonthData || []);
      }
    } catch (error) {
      console.error('Exception fetching holidays:', error);
      setError('Failed to fetch holidays');
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  const generateHolidayContent = async (holidayId: string) => {
    try {
      console.log('Generating content for holiday:', holidayId);
      
      const { data, error } = await supabase.functions.invoke('generate-holiday-content', {
        body: { holiday_id: holidayId }
      });

      if (error) {
        console.error('Error generating holiday content:', error);
        throw new Error(error.message || 'Failed to generate content');
      }

      console.log('Holiday content generated successfully:', data);
      return data;
    } catch (error) {
      console.error('Exception generating holiday content:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchUpcomingHolidays();
  }, [user]);

  return {
    holidays,
    loading,
    error,
    generateHolidayContent,
    refreshHolidays: fetchUpcomingHolidays
  };
};
