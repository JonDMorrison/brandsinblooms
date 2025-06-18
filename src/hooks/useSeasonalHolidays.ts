
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎯 Attempt ${attempt}/${maxRetries}: Generating content for holiday:`, holidayId);
        
        // Add connection test
        if (attempt === 1) {
          console.log('🔍 Testing Supabase connection...');
          const { data: testData } = await supabase.from('holidays').select('id').limit(1);
          console.log('✅ Supabase connection test successful:', testData ? 'Connected' : 'No data');
        }

        const { data, error } = await supabase.functions.invoke('generate-holiday-content', {
          body: { holiday_id: holidayId },
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (error) {
          console.error(`❌ Attempt ${attempt} failed with Supabase error:`, {
            message: error.message,
            context: error.context,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          
          // Check if this is a connectivity issue
          if (error.message?.includes('FunctionsFetchError') || 
              error.message?.includes('Failed to fetch') ||
              error.message?.includes('Network Error')) {
            
            lastError = new Error(`Connection failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
            
            if (attempt < maxRetries) {
              console.log(`⏳ Retrying in ${attempt * 2} seconds...`);
              await new Promise(resolve => setTimeout(resolve, attempt * 2000));
              continue;
            }
          } else {
            // Non-connectivity error, don't retry
            throw new Error(error.message || 'Edge function error');
          }
        } else {
          console.log('✅ Holiday content generated successfully:', data);
          return data;
        }
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed with exception:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }

    // All attempts failed
    const finalError = lastError || new Error('Unknown error occurred');
    console.error('💥 All retry attempts failed:', finalError);
    
    // Show helpful error message to user
    if (finalError.message.includes('FunctionsFetchError') || 
        finalError.message.includes('Failed to fetch')) {
      toast.error('Connection issue detected', {
        description: 'Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.',
        duration: 8000,
      });
    } else if (finalError.message.includes('OPENAI_API_KEY')) {
      toast.error('Configuration issue', {
        description: 'OpenAI API key is not properly configured. Please contact support.',
        duration: 8000,
      });
    } else {
      toast.error('Content generation failed', {
        description: finalError.message,
        duration: 8000,
      });
    }
    
    throw finalError;
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
