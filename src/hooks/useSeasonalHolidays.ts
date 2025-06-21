
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from './useTenant';
import { generateHolidayContent } from '@/components/homepage/HolidayGenerationService';
import { toast } from 'sonner';

interface Holiday {
  id: string;
  holiday_name: string;
  holiday_date: string;
  description?: string;
  garden_relevance?: string;
  category?: string;
}

interface HolidayContentState {
  hasContent: boolean;
  contentCount: number;
  lastGenerated?: string;
}

export const useSeasonalHolidays = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayContentState, setHolidayContentState] = useState<Record<string, HolidayContentState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    try {
      console.log('Fetching seasonal holidays...');
      
      const today = new Date();
      const threeMonthsFromNow = new Date();
      threeMonthsFromNow.setMonth(today.getMonth() + 3);

      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_active', true)
        .gte('holiday_date', today.toISOString().split('T')[0])
        .lte('holiday_date', threeMonthsFromNow.toISOString().split('T')[0])
        .order('holiday_date', { ascending: true })
        .limit(12);

      if (error) {
        console.error('Error fetching holidays:', error);
        setError(`Failed to load holidays: ${error.message}`);
        return;
      }

      console.log(`Found ${data?.length || 0} upcoming holidays`);
      setHolidays(data || []);
      setError(null);
    } catch (err) {
      console.error('Exception fetching holidays:', err);
      setError('An unexpected error occurred while loading holidays');
    }
  }, []);

  // Fetch content state for holidays
  const fetchHolidayContentState = useCallback(async () => {
    if (!user || !tenant || holidays.length === 0) return;

    try {
      console.log('Fetching holiday content state...');
      
      const holidayIds = holidays.map(h => h.id);
      
      const { data: tasks, error } = await supabase
        .from('content_tasks')
        .select('holiday_id, post_type, created_at')
        .in('holiday_id', holidayIds)
        .eq('tenant_id', tenant.id);

      if (error) {
        console.error('Error fetching holiday content state:', error);
        return;
      }

      // Build content state map
      const contentState: Record<string, HolidayContentState> = {};
      
      holidays.forEach(holiday => {
        const holidayTasks = tasks?.filter(task => task.holiday_id === holiday.id) || [];
        const hasAllFiveTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter']
          .every(type => holidayTasks.some(task => task.post_type === type));
        
        contentState[holiday.id] = {
          hasContent: hasAllFiveTypes,
          contentCount: holidayTasks.length,
          lastGenerated: holidayTasks.length > 0 
            ? Math.max(...holidayTasks.map(t => new Date(t.created_at).getTime()))
            : undefined
        };
      });

      setHolidayContentState(contentState);
    } catch (err) {
      console.error('Exception fetching holiday content state:', err);
    }
  }, [user, tenant, holidays]);

  // Generate content for a holiday
  const generateHolidayContent = useCallback(async (holidayId: string) => {
    if (!user || !tenant) {
      throw new Error('User authentication required');
    }

    const holiday = holidays.find(h => h.id === holidayId);
    if (!holiday) {
      throw new Error('Holiday not found');
    }

    console.log(`🎉 Starting content generation for holiday: ${holiday.holiday_name}`);
    
    try {
      toast.loading(`Generating content for ${holiday.holiday_name}...`, {
        duration: 30000,
        id: `holiday-gen-${holidayId}`
      });

      const results = await generateHolidayContent(user, holiday, tenant, fetchHolidayContentState);
      
      // Check results
      const successCount = results.filter(r => r.success).length;
      const totalExpected = 5; // instagram, facebook, blog, video, newsletter
      
      toast.dismiss(`holiday-gen-${holidayId}`);
      
      if (successCount === totalExpected) {
        toast.success(`All 5 content pieces generated for ${holiday.holiday_name}!`, {
          description: 'Instagram, Facebook, Blog, Video, and Newsletter are ready for review.'
        });
      } else {
        toast.warning(`${successCount}/${totalExpected} content pieces generated`, {
          description: 'Some content generation may have failed. Check the review queue.'
        });
      }

      // Refresh content state
      await fetchHolidayContentState();
      
      return results;
    } catch (error) {
      console.error('Error generating holiday content:', error);
      toast.dismiss(`holiday-gen-${holidayId}`);
      toast.error(`Failed to generate content for ${holiday.holiday_name}`, {
        description: error.message
      });
      throw error;
    }
  }, [user, tenant, holidays, fetchHolidayContentState]);

  // Refresh content state
  const refreshHolidayContent = useCallback(async () => {
    await fetchHolidayContentState();
  }, [fetchHolidayContentState]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    setLoading(true);
    fetchHolidays().finally(() => setLoading(false));
  }, [fetchHolidays]);

  useEffect(() => {
    if (holidays.length > 0) {
      fetchHolidayContentState();
    }
  }, [fetchHolidayContentState]);

  return {
    holidays,
    holidayContentState,
    loading,
    error,
    generateHolidayContent,
    refreshHolidayContent,
    refetch: fetchHolidays
  };
};
