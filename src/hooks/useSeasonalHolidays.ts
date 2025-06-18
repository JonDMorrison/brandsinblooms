
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Holiday {
  id: string;
  holiday_name: string;
  holiday_date: string;
  description: string;
  category: string;
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

      // Get holidays in the next 30 days
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      console.log('Fetching holidays between:', today, 'and', thirtyDaysFromNow);

      const { data, error: fetchError } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_active', true)
        .gte('holiday_date', today)
        .lte('holiday_date', thirtyDaysFromNow)
        .order('holiday_date', { ascending: true });

      if (fetchError) {
        console.error('Error fetching holidays:', fetchError);
        setError(fetchError.message);
        setHolidays([]);
      } else {
        console.log('Fetched holidays:', data);
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

  useEffect(() => {
    fetchUpcomingHolidays();
  }, [user]);

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

  return {
    holidays,
    loading,
    error,
    generateHolidayContent,
    refreshHolidays: fetchUpcomingHolidays
  };
};
