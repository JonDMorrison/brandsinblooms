
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Holiday {
  id: string;
  name: string;
  category: 'Month' | 'Week' | 'Day';
  when: string;
  description: string;
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

      const { data, error: fetchError } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_active', true)
        .order('when', { ascending: true })
        .limit(20);

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
