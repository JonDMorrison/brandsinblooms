
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

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
}

// Helper function to get current week number (1-52)
const getCurrentWeekNumber = (): number => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
};

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

// Transform database theme to FocusTheme format
const transformTheme = (dbTheme: any): FocusTheme => ({
  id: `week-${dbTheme.week_number}`,
  title: dbTheme.title,
  description: dbTheme.content_ideas || dbTheme.theme || 'Seasonal gardening activities and tips',
  teaser: dbTheme.seasonal_focus || dbTheme.target_audience_notes || 'Professional garden center guidance',
  category: categorizeTheme(dbTheme),
  tags: generateTags(dbTheme),
  difficulty: getDifficulty(dbTheme),
  timeToComplete: getTimeCommitment(dbTheme),
  seasonality: generateTags(dbTheme).filter(tag => ['spring', 'summer', 'fall', 'winter'].includes(tag))
});

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
      
      // Fetch themes around current week (current + next 4 weeks for variety)
      const weekNumbers = [
        currentWeek,
        (currentWeek % 52) + 1,
        ((currentWeek + 1) % 52) + 1,
        ((currentWeek + 2) % 52) + 1,
        ((currentWeek + 3) % 52) + 1
      ];

      console.log('🗓️ Fetching themes for weeks:', weekNumbers, 'Current week:', currentWeek);

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

      // Transform database themes to FocusTheme format
      let transformedThemes = (masterThemes || []).map(transformTheme);

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

      console.log('✅ Final filtered themes:', filteredThemes.length);
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
