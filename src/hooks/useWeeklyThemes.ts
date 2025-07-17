import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentWeekNumber } from '@/utils/dateUtils';

export interface WeeklyTheme {
  id: string;
  title: string;
  description: string;
  teaser: string;
  category: 'plant_care' | 'decor' | 'sale' | 'holidays';
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeToComplete: string;
  weekNumber: number;
  label?: 'Past' | 'Current' | 'Future';
  isCurrentWeek: boolean;
  campaignId?: string; // Add campaign ID for proper theme-to-content matching
}

// Helper function to determine category based on content
const categorizeTheme = (theme: any): 'plant_care' | 'decor' | 'sale' | 'holidays' => {
  const title = theme.title?.toLowerCase() || '';
  const content = theme.content_ideas?.toLowerCase() || '';
  const seasonal = theme.seasonal_focus?.toLowerCase() || '';
  
  if (title.includes('sale') || title.includes('promotion') || content.includes('sale')) return 'sale';
  if (title.includes('holiday') || title.includes('festive') || seasonal.includes('holiday')) return 'holidays';
  if (title.includes('decor') || title.includes('design') || content.includes('decoration')) return 'decor';
  return 'plant_care';
};

// Helper function to determine difficulty
const getDifficulty = (theme: any): 'beginner' | 'intermediate' | 'advanced' => {
  const content = theme.content_ideas?.toLowerCase() || '';
  const notes = theme.target_audience_notes?.toLowerCase() || '';
  
  if (content.includes('advanced') || content.includes('expert') || notes.includes('experienced')) return 'advanced';
  if (content.includes('beginner') || content.includes('easy') || notes.includes('new')) return 'beginner';
  return 'intermediate';
};

// Helper function to estimate time commitment
const getTimeCommitment = (theme: any): string => {
  const content = theme.content_ideas?.toLowerCase() || '';
  
  if (content.includes('quick') || content.includes('simple')) return '30 minutes';
  if (content.includes('comprehensive') || content.includes('detailed')) return '2-3 hours';
  return '1 hour';
};

// Helper function to generate tags
const generateTags = (theme: any): string[] => {
  const tags: string[] = [];
  const content = (theme.content_ideas || '').toLowerCase();
  const seasonal = (theme.seasonal_focus || '').toLowerCase();
  
  if (seasonal.includes('spring')) tags.push('spring');
  if (seasonal.includes('summer')) tags.push('summer');
  if (seasonal.includes('fall') || seasonal.includes('autumn')) tags.push('fall');
  if (seasonal.includes('winter')) tags.push('winter');
  
  if (content.includes('planting')) tags.push('planting');
  if (content.includes('harvest')) tags.push('harvest');
  if (content.includes('maintenance')) tags.push('maintenance');
  if (content.includes('care')) tags.push('care');
  if (content.includes('design')) tags.push('design');
  if (content.includes('decoration')) tags.push('decoration');
  
  return tags.length > 0 ? tags : ['seasonal'];
};

const transformTheme = (dbTheme: any, currentWeek: number): WeeklyTheme => {
  const weekDiff = dbTheme.week_number - currentWeek;
  const isCurrentWeek = dbTheme.week_number === currentWeek;
  
  let label: 'Past' | 'Current' | 'Future' | undefined;
  if (weekDiff < 0) label = 'Past';
  if (weekDiff === 0) label = 'Current';
  if (weekDiff > 0) label = 'Future';
  
  return {
    id: `week-${dbTheme.week_number}`,
    title: dbTheme.title,
    description: dbTheme.content_ideas || dbTheme.theme || 'Seasonal gardening activities and tips',
    teaser: dbTheme.seasonal_focus || dbTheme.target_audience_notes || 'Professional garden center guidance',
    category: categorizeTheme(dbTheme),
    tags: generateTags(dbTheme),
    difficulty: getDifficulty(dbTheme),
    timeToComplete: getTimeCommitment(dbTheme),
    weekNumber: dbTheme.week_number,
    label,
    isCurrentWeek
  };
};

const createFallbackTheme = (weekNumber: number, currentWeek: number): WeeklyTheme => {
  const weekDiff = weekNumber - currentWeek;
  const isCurrentWeek = weekNumber === currentWeek;
  
  let label: 'Past' | 'Current' | 'Future' | undefined;
  if (weekDiff < 0) label = 'Past';
  if (weekDiff === 0) label = 'Current';
  if (weekDiff > 0) label = 'Future';
  
  return {
    id: `week-${weekNumber}`,
    title: `Week ${weekNumber} Garden Care`,
    description: 'General garden maintenance and seasonal activities for this week',
    teaser: 'Essential garden care tasks and seasonal tips',
    category: 'plant_care',
    tags: ['seasonal', 'maintenance'],
    difficulty: 'intermediate',
    timeToComplete: '1 hour',
    weekNumber,
    label,
    isCurrentWeek
  };
};

export const useWeeklyThemes = () => {
  const { user } = useAuth();
  const [themes, setThemes] = useState<WeeklyTheme[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThemes = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const currentWeek = getCurrentWeekNumber();
      
      // Calculate the 5 weeks: current ± 2 weeks
      const weekNumbers: number[] = [];
      for (let i = -2; i <= 2; i++) {
        let week = currentWeek + i;
        // Handle year boundaries
        if (week <= 0) week += 52;
        if (week > 52) week -= 52;
        weekNumbers.push(week);
      }

      console.log('🗓️ Fetching 5 weekly themes:', weekNumbers, 'Current week:', currentWeek);

      // Fetch master themes and their corresponding campaigns
      const [masterThemesResult, campaignsResult] = await Promise.all([
        supabase
          .from('master_campaign_templates')
          .select('*')
          .in('week_number', weekNumbers)
          .order('week_number'),
        supabase
          .from('campaigns')
          .select('id, title, week_number, user_id, tenant_id')
          .eq('user_id', user.id)
          .in('week_number', weekNumbers)
          .order('created_at', { ascending: false })
      ]);

      if (masterThemesResult.error) {
        console.error('Error fetching master themes:', masterThemesResult.error);
        setThemes([]);
        setLoading(false);
        return;
      }

      if (campaignsResult.error) {
        console.error('Error fetching campaigns:', campaignsResult.error);
      }

      const masterThemes = masterThemesResult.data;
      const campaigns = campaignsResult.data || [];

      console.log('📊 Fetched master themes:', masterThemes?.length || 0);
      console.log('🎯 Fetched user campaigns:', campaigns?.length || 0);

      // Create themes array ensuring we have exactly 5 themes in chronological order
      const orderedThemes: WeeklyTheme[] = [];
      
      for (const weekNum of weekNumbers) {
        const dbTheme = masterThemes?.find(t => t.week_number === weekNum);
        // Find matching campaign for this theme
        const matchingCampaign = campaigns.find(c => 
          c.week_number === weekNum && 
          (dbTheme ? c.title === dbTheme.title : false)
        );
        
        if (dbTheme) {
          const theme = transformTheme(dbTheme, currentWeek);
          theme.campaignId = matchingCampaign?.id;
          orderedThemes.push(theme);
        } else {
          // Create fallback theme if no master template exists
          const theme = createFallbackTheme(weekNum, currentWeek);
          theme.campaignId = matchingCampaign?.id;
          orderedThemes.push(theme);
        }
      }

      console.log('✅ Final ordered themes:', orderedThemes.map(t => ({ week: t.weekNumber, title: t.title, label: t.label })));
      
      setThemes(orderedThemes);
    } catch (error) {
      console.error('Error loading weekly themes:', error);
      setThemes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, [user]);

  return {
    themes,
    loading
  };
};