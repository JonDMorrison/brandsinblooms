
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
// Removed sonner import - using global toast replacement

interface HolidayUpdateResult {
  success: boolean;
  year: number;
  holidays_generated: number;
  holidays_deactivated: number;
  errors?: string[];
  message: string;
}

export const useHolidayCalendarUpdate = () => {
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<HolidayUpdateResult | null>(null);

  const updateHolidayCalendar = async (targetYear?: number) => {
    setLoading(true);
    
    try {
      console.log('Triggering holiday calendar update for year:', targetYear);
      
      const { data, error } = await supabase.functions.invoke('update-holiday-calendar', {
        body: { 
          target_year: targetYear || new Date().getFullYear() + 1,
          trigger_type: 'manual'
        }
      });

      if (error) {
        console.error('Error updating holiday calendar:', error);
        toast.error('Failed to update holiday calendar', {
          description: error.message,
        });
        return null;
      }

      console.log('Holiday calendar update result:', data);
      setLastUpdate(data);

      if (data.success) {
        toast.success(`Holiday calendar updated for ${data.year}!`, {
          description: data.message,
          duration: 5000,
        });
      } else {
        toast.warning('Holiday calendar update completed with warnings', {
          description: data.errors?.join('; ') || 'Some holidays may not have been processed correctly',
          duration: 7000,
        });
      }

      return data;
    } catch (error) {
      console.error('Exception updating holiday calendar:', error);
      toast.error('Failed to update holiday calendar', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getGenerationLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('holiday_generation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching generation logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching generation logs:', error);
      return [];
    }
  };

  return {
    updateHolidayCalendar,
    getGenerationLogs,
    loading,
    lastUpdate
  };
};
