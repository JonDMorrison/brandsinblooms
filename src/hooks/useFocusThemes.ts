
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

const SAMPLE_THEMES: FocusTheme[] = [
  {
    id: 'winter-prep-2024',
    title: 'Winter Garden Preparation',
    description: 'Essential steps to protect your plants and prepare your garden for the winter months.',
    teaser: 'Winterizing tips, plant protection strategies, and seasonal garden maintenance.',
    category: 'plant_care',
    tags: ['winter', 'protection', 'maintenance', 'seasonal'],
    difficulty: 'intermediate',
    timeToComplete: '2-3 hours',
    seasonality: ['winter', 'fall']
  },
  {
    id: 'holiday-decor-2024',
    title: 'Festive Garden Decorations',
    description: 'Transform your garden into a winter wonderland with beautiful holiday decorations.',
    teaser: 'DIY holiday crafts, outdoor lighting ideas, and festive plant arrangements.',
    category: 'decor',
    tags: ['holidays', 'decorations', 'lighting', 'crafts'],
    difficulty: 'beginner',
    timeToComplete: '1-2 hours',
    seasonality: ['winter']
  },
  {
    id: 'year-end-sale-2024',
    title: 'Year-End Garden Sale',
    description: 'Clear out inventory and offer great deals on gardening supplies and plants.',
    teaser: 'Promotional strategies, clearance sales, and customer engagement ideas.',
    category: 'sale',
    tags: ['promotion', 'sale', 'clearance', 'marketing'],
    difficulty: 'beginner',
    timeToComplete: '30 minutes',
    seasonality: ['winter']
  },
  {
    id: 'new-year-planning-2025',
    title: 'New Year Garden Planning',
    description: 'Start the new year right with comprehensive garden planning and goal setting.',
    teaser: 'Garden design, seed planning, seasonal calendar, and growth tracking.',
    category: 'plant_care',
    tags: ['planning', 'goals', 'design', 'seeds'],
    difficulty: 'intermediate',
    timeToComplete: '1-2 hours',
    seasonality: ['winter', 'spring']
  },
  {
    id: 'indoor-gardening-winter',
    title: 'Indoor Winter Gardening',
    description: 'Keep your green thumb active during winter with indoor gardening projects.',
    teaser: 'Houseplants, herb gardens, sprouting, and winter growing techniques.',
    category: 'plant_care',
    tags: ['indoor', 'houseplants', 'herbs', 'winter'],
    difficulty: 'beginner',
    timeToComplete: '1 hour',
    seasonality: ['winter']
  }
];

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
      // Only fetch user_theme_status if we have a tenant_id
      let userThemeStatuses: any[] = [];
      if (tenant?.id) {
        const { data: statusData } = await supabase
          .from('user_theme_status')
          .select('theme_id, status')
          .eq('tenant_id', tenant.id);
        
        userThemeStatuses = statusData || [];
      }

      // Filter themes based on user status and filters
      let filteredThemes = SAMPLE_THEMES.filter(theme => {
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

      setThemes(filteredThemes);
    } catch (error) {
      console.error('Error loading themes:', error);
      // Fallback to all themes if there's an error
      setThemes(SAMPLE_THEMES);
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
