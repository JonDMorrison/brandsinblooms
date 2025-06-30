
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { getCurrentWeekNumber } from '@/utils/dateUtils';
import { calculateSeasonalScore, shouldShowPlanningAheadLabel, detectThemeSeason } from '@/utils/seasonalUtils';

export interface FocusTheme {
  id: string;
  title: string;
  description: string;
  teaser: string;
  category: 'plant_care' | 'decor' | 'sale' | 'holidays';
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeToComplete: string;
  seasonality?: string[];
  // New seasonal properties
  weekNumber: number;
  seasonalScore: number;
  label?: 'Planning Ahead' | 'Current Season';
  isSeasonallyAppropriate: boolean;
  themeSeason: 'spring' | 'summer' | 'fall' | 'winter' | 'neutral';
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

// Enhanced transform function with seasonal data
const transformTheme = (dbTheme: any, currentWeek: number): FocusTheme => {
  const seasonalScore = calculateSeasonalScore(dbTheme, currentWeek);
  const themeSeason = detectThemeSeason(dbTheme);
  const showPlanningAhead = shouldShowPlanningAheadLabel(dbTheme, currentWeek);
  
  return {
    id: `week-${dbTheme.week_number}`,
    title: dbTheme.title,
    description: dbTheme.content_ideas || dbTheme.theme || 'Seasonal gardening activities and tips',
    teaser: dbTheme.seasonal_focus || dbTheme.target_audience_notes || 'Professional garden center guidance',
    category: categorizeTheme(dbTheme),
    tags: generateTags(dbTheme),
    difficulty: getDifficulty(dbTheme),
    timeToComplete: getTimeCommitment(dbTheme),
    seasonality: generateTags(dbTheme).filter(tag => ['spring', 'summer', 'fall', 'winter'].includes(tag)),
    // New seasonal properties
    weekNumber: dbTheme.week_number,
    seasonalScore,
    label: showPlanningAhead ? 'Planning Ahead' : (seasonalScore >= 80 ? 'Current Season' : undefined),
    isSeasonallyAppropriate: seasonalScore >= 60,
    themeSeason
  };
};

export interface FocusFilters {
  categories: string[];
  difficulty: string[];
  timeCommitment: string[];
  showCompleted: boolean;
}

export const useFocusThemes = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [themes, setThemes] = useState<FocusTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FocusFilters>({
    categories: [],
    difficulty: [],
    timeCommitment: [],
    showCompleted: false
  });

  const loadThemes = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const currentWeek = getCurrentWeekNumber();
      
      // Fetch themes within a 5-week range (current + 4 weeks ahead)
      const weekNumbers = [];
      for (let i = 0; i < 5; i++) {
        const week = ((currentWeek + i - 1) % 52) + 1;
        weekNumbers.push(week);
      }

      console.log('🗓️ Fetching themes for weeks:', weekNumbers, 'Current week (ISO):', currentWeek);

      const { data: masterThemes, error } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .in('week_number', weekNumbers)
        .order('week_number');

      if (error) {
        console.error('Error fetching master themes:', error);
        setThemes([]);
        setLoading(false);
        return;
      }

      console.log('📊 Fetched master themes:', masterThemes?.length || 0);

      // Transform themes with seasonal data
      let transformedThemes = (masterThemes || []).map(theme => transformTheme(theme, currentWeek));

      // Additional filter: Remove themes that are more than 5 weeks away
      transformedThemes = transformedThemes.filter(theme => {
        const weekDifference = theme.weekNumber - currentWeek;
        // Handle year wrap-around: if weekDifference is very negative, it's likely next year
        const adjustedWeekDiff = weekDifference < -26 ? weekDifference + 52 : weekDifference;
        return adjustedWeekDiff <= 5 && adjustedWeekDiff >= 0;
      });

      // Get user theme status if we have tenant data
      let userThemeStatuses: any[] = [];
      if (tenant?.id && transformedThemes.length > 0) {
        const themeIds = transformedThemes.map(t => t.id);
        const { data: statusData } = await supabase
          .from('user_theme_status')
          .select('theme_id, status')
          .eq('tenant_id', tenant.id)
          .in('theme_id', themeIds);
        
        userThemeStatuses = statusData || [];
      }

      // Filter themes based on user status and filters
      let filteredThemes = transformedThemes.filter(theme => {
        // Skip if user has already generated or skipped this theme (only if we have tenant data)
        if (tenant?.id) {
          const userStatus = userThemeStatuses.find(s => s.theme_id === theme.id);
          if (userStatus && ['generated', 'skipped'].includes(userStatus.status)) {
            return filters.showCompleted;
          }
        }

        // Filter out themes with very poor seasonal scores (unless showing completed)
        if (!filters.showCompleted && theme.seasonalScore < 20) {
          return false;
        }

        // Apply category filter
        if (filters.categories.length > 0 && !filters.categories.includes(theme.category)) {
          return false;
        }

        // Apply difficulty filter
        if (filters.difficulty.length > 0 && !filters.difficulty.includes(theme.difficulty)) {
          return false;
        }

        // Apply time commitment filter
        if (filters.timeCommitment.length > 0) {
          const timeMatch = filters.timeCommitment.some(time => {
            if (time === 'quick' && theme.timeToComplete.includes('30 minutes')) return true;
            if (time === 'short' && theme.timeToComplete.includes('1 hour')) return true;
            if (time === 'medium' && theme.timeToComplete.includes('2-3 hours')) return true;
            return false;
          });
          if (!timeMatch) return false;
        }

        return true;
      });

      // Sort themes by seasonal appropriateness (highest score first)
      filteredThemes.sort((a, b) => {
        // Primary sort: seasonal score (higher is better)
        if (b.seasonalScore !== a.seasonalScore) {
          return b.seasonalScore - a.seasonalScore;
        }
        
        // Secondary sort: week proximity to current week
        const currentWeekDiffA = Math.abs(a.weekNumber - currentWeek);
        const currentWeekDiffB = Math.abs(b.weekNumber - currentWeek);
        return currentWeekDiffA - currentWeekDiffB;
      });

      console.log('✅ Final filtered and sorted themes:', filteredThemes.length);
      console.log('🎯 Theme seasonal scores:', filteredThemes.map(t => ({ title: t.title, score: t.seasonalScore, label: t.label })));
      
      setThemes(filteredThemes);
    } catch (error) {
      console.error('Error loading themes:', error);
      setThemes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, [user, tenant, filters]);

  const updateFilters = (newFilters: Partial<FocusFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const skipTheme = async (themeId: string) => {
    if (!user || !tenant?.id) return;

    try {
      await supabase
        .from('user_theme_status')
        .upsert({
          user_id: user.id,
          tenant_id: tenant.id,
          theme_id: themeId,
          status: 'skipped',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
        });

      // Reload themes to reflect the change
      await loadThemes();
    } catch (error) {
      console.error('Error skipping theme:', error);
    }
  };

  const markGenerated = async (themeId: string) => {
    if (!user || !tenant?.id) return;

    try {
      await supabase
        .from('user_theme_status')
        .upsert({
          user_id: user.id,
          tenant_id: tenant.id,
          theme_id: themeId,
          status: 'generated'
        });

      // Reload themes to reflect the change
      await loadThemes();
    } catch (error) {
      console.error('Error marking theme as generated:', error);
    }
  };

  return {
    themes,
    loading,
    filters,
    updateFilters,
    skipTheme,
    markGenerated
  };
};
