
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

      // Get current date and 90 days from now for a good range
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 90);

      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      console.log('Date range:', todayStr, 'to', futureDateStr);

      const { data, error: fetchError } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_active', true)
        .gte('holiday_date', todayStr)
        .lte('holiday_date', futureDateStr)
        .order('holiday_date', { ascending: true })
        .limit(10);

      if (fetchError) {
        console.error('Error fetching holidays:', fetchError);
        setError(fetchError.message);
        setHolidays([]);
      } else {
        console.log('Fetched holidays:', data?.length || 0, 'holidays found');
        console.log('Holiday data:', data);
        setHolidays(data || []);
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
