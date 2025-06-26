import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from './useTenant';
import { generateHolidayContent } from '@/components/homepage/HolidayGenerationService';
import { toast } from 'sonner';
import { filterExpiredHolidays, hasExpiredHolidays } from '@/utils/dateUtils';

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
  const [allHolidays, setAllHolidays] = useState<Holiday[]>([]);
  const [holidayContentState, setHolidayContentState] = useState<Record<string, HolidayContentState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch holidays with client-side expired filtering - fetch up to 20 for pagination
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
        .limit(20); // Fetch up to 20 for pagination

      if (error) {
        console.error('Error fetching holidays:', error);
        setError(`Failed to load holidays: ${error.message}`);
        return;
      }

      // Apply client-side filtering to remove any expired holidays
      const filteredHolidays = filterExpiredHolidays(data || []);
      
      console.log(`Found ${data?.length || 0} holidays from database, ${filteredHolidays.length} after filtering expired ones`);
      setAllHolidays(filteredHolidays);
      setError(null);
    } catch (err) {
      console.error('Exception fetching holidays:', err);
      setError('An unexpected error occurred while loading holidays');
    }
  }, []);

  // Check for expired holidays and refresh if needed
  const checkAndRemoveExpiredHolidays = useCallback(() => {
    if (allHolidays.length > 0 && hasExpiredHolidays(allHolidays)) {
      console.log('Found expired holidays, refreshing list...');
      const filteredHolidays = filterExpiredHolidays(allHolidays);
      setAllHolidays(filteredHolidays);
      
      // Also update content state to remove expired holiday references
      const updatedContentState = { ...holidayContentState };
      Object.keys(updatedContentState).forEach(holidayId => {
        const stillExists = filteredHolidays.some(h => h.id === holidayId);
        if (!stillExists) {
          delete updatedContentState[holidayId];
        }
      });
      setHolidayContentState(updatedContentState);
    }
  }, [allHolidays, holidayContentState]);

  // Fetch content state for holidays with improved fallback logic
  const fetchHolidayContentState = useCallback(async () => {
    if (!user || allHolidays.length === 0) return;

    try {
      console.log('Fetching holiday content state...');
      
      const holidayIds = allHolidays.map(h => h.id);
      
      // Try tenant-based query first, then fallback to user-based
      let tasks = null;
      let error = null;

      if (tenant) {
        const { data: tenantTasks, error: tenantError } = await supabase
          .from('content_tasks')
          .select('holiday_id, post_type, created_at')
          .in('holiday_id', holidayIds)
          .eq('tenant_id', tenant.id);

        if (tenantError) {
          console.warn('Tenant-based query failed, trying user-based:', tenantError);
        } else {
          tasks = tenantTasks;
        }
      }

      // Fallback to user-based query if tenant query failed or no tenant
      if (!tasks) {
        const { data: userTasks, error: userError } = await supabase
          .from('content_tasks')
          .select('holiday_id, post_type, created_at')
          .in('holiday_id', holidayIds)
          .eq('user_id', user.id);

        if (userError) {
          console.error('User-based query also failed:', userError);
          error = userError;
        } else {
          tasks = userTasks;
        }
      }

      if (error) {
        console.error('Error fetching holiday content state:', error);
        return;
      }

      // Build content state map with improved logic
      const contentState: Record<string, HolidayContentState> = {};
      
      allHolidays.forEach(holiday => {
        const holidayTasks = tasks?.filter(task => task.holiday_id === holiday.id) || [];
        const uniquePostTypes = [...new Set(holidayTasks.map(task => task.post_type))];
        const hasAllFiveTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter']
          .every(type => uniquePostTypes.includes(type));
        
        const latestTimestamp = holidayTasks.length > 0 
          ? Math.max(...holidayTasks.map(t => new Date(t.created_at).getTime()))
          : undefined;
        
        contentState[holiday.id] = {
          hasContent: hasAllFiveTypes,
          contentCount: uniquePostTypes.length,
          lastGenerated: latestTimestamp ? new Date(latestTimestamp).toISOString() : undefined
        };
      });

      console.log('Holiday content state updated:', contentState);
      setHolidayContentState(contentState);
    } catch (err) {
      console.error('Exception fetching holiday content state:', err);
    }
  }, [user, tenant, allHolidays]);

  // Generate content for a holiday
  const generateHolidayContentForHoliday = useCallback(async (holidayId: string) => {
    console.log(`🎯 HOOK: Starting generation for holiday ID: ${holidayId}`);
    
    if (!user || !tenant) {
      const errorMsg = 'User authentication required';
      console.error(`🎯 HOOK ERROR: ${errorMsg}`, { user: !!user, tenant: !!tenant });
      throw new Error(errorMsg);
    }

    const holiday = allHolidays.find(h => h.id === holidayId);
    if (!holiday) {
      const errorMsg = 'Holiday not found';
      console.error(`🎯 HOOK ERROR: ${errorMsg}`, { holidayId, availableHolidays: allHolidays.length });
      throw new Error(errorMsg);
    }

    console.log(`🎯 HOOK: Found holiday: ${holiday.holiday_name}, calling service...`);
    
    try {
      const results = await generateHolidayContent(user, holiday, tenant, fetchHolidayContentState);
      
      console.log(`🎯 HOOK: Service returned results:`, results);
      
      // Check results and provide detailed feedback
      const successCount = results.filter(r => r.success).length;
      const failedResults = results.filter(r => !r.success);
      const totalExpected = 5; // instagram, facebook, blog, video, newsletter
      
      if (successCount === totalExpected) {
        toast.success(`All 5 content pieces generated for ${holiday.holiday_name}!`, {
          description: 'Instagram, Facebook, Blog, Video, and Newsletter are ready for review.'
        });
      } else if (successCount > 0) {
        toast.warning(`${successCount}/${totalExpected} content pieces generated`, {
          description: `Successfully created: ${results.filter(r => r.success).map(r => r.type).join(', ')}`
        });
        
        if (failedResults.length > 0) {
          console.error('🎯 HOOK: Failed content types:', failedResults);
        }
      } else {
        // Complete failure - throw error with details
        const errorDetails = failedResults.map(r => `${r.type}: ${r.error}`).join('; ');
        const errorMsg = `Content generation failed for all types. Details: ${errorDetails}`;
        console.error('🎯 HOOK ERROR: Complete failure:', errorMsg);
        throw new Error(errorMsg);
      }

      // Refresh content state
      console.log(`🎯 HOOK: Refreshing content state...`);
      await fetchHolidayContentState();
      
      return results;
    } catch (error) {
      console.error('🎯 HOOK: Error in generateHolidayContentForHoliday:', error);
      
      // Provide more specific error messages
      let errorMessage = 'An unexpected error occurred';
      if (error?.message) {
        if (error.message.includes('OpenAI')) {
          errorMessage = 'AI content generation service is currently unavailable';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network connection issue - please check your internet';
        } else if (error.message.includes('authentication') || error.message.includes('auth')) {
          errorMessage = 'Authentication issue - please refresh and try again';
        } else {
          errorMessage = error.message;
        }
      }
      
      console.error('🎯 HOOK: Final error message:', errorMessage);
      throw new Error(errorMessage);
    }
  }, [user, tenant, allHolidays, fetchHolidayContentState]);

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
    if (allHolidays.length > 0) {
      fetchHolidayContentState();
    }
  }, [fetchHolidayContentState, allHolidays.length]);

  // Set up periodic check for expired holidays (every hour and on page focus)
  useEffect(() => {
    const checkInterval = setInterval(checkAndRemoveExpiredHolidays, 60 * 60 * 1000); // Check every hour
    
    const handleFocus = () => {
      checkAndRemoveExpiredHolidays();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkAndRemoveExpiredHolidays]);

  return {
    allHolidays,
    holidayContentState,
    loading,
    error,
    generateHolidayContent: generateHolidayContentForHoliday,
    refreshHolidayContent,
    refetch: fetchHolidays
  };
};
