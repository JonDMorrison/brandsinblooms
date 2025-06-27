
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export interface FocusTheme {
  id: string;
  title: string;
  description: string;
  category: 'plant_care' | 'decor' | 'sale' | 'holidays';
  teaser: string;
  status?: 'generated' | 'skipped' | null;
}

export interface ThemeFilters {
  plant_care: boolean;
  decor: boolean;
  sale: boolean;
  holidays: boolean;
}

const DEFAULT_FILTERS: ThemeFilters = {
  plant_care: true,
  decor: true,
  sale: true,
  holidays: true
};

// Sample themes data - in a real app this would come from the database
const SAMPLE_THEMES: FocusTheme[] = [
  {
    id: 'summer-annuals',
    title: 'Summer Annual Selection',
    description: 'Guide customers on choosing heat-loving annual flowers for summer gardens',
    category: 'plant_care',
    teaser: "We'll create: 'How to choose heat-loving annuals' + 4 matching pieces"
  },
  {
    id: 'container-gardens',
    title: 'Container Garden Design',
    description: 'Tips for creating beautiful container arrangements',
    category: 'decor',
    teaser: "We'll create: 'Container garden design basics' + 4 styling pieces"
  },
  {
    id: 'summer-sale',
    title: 'Mid-Summer Plant Sale',
    description: 'Promote summer clearance and new arrivals',
    category: 'sale',
    teaser: "We'll create: 'Summer sale highlights' + 4 promotional pieces"
  },
  {
    id: 'independence-day',
    title: 'Independence Day Gardening',
    description: 'Red, white, and blue themed garden content',
    category: 'holidays',
    teaser: "We'll create: 'Patriotic garden ideas' + 4 festive pieces"
  },
  {
    id: 'drought-resistant',
    title: 'Drought-Resistant Plants',
    description: 'Water-wise gardening for hot summer months',
    category: 'plant_care',
    teaser: "We'll create: 'Drought-resistant plant guide' + 4 care pieces"
  },
  {
    id: 'outdoor-decor',
    title: 'Summer Garden Decor',
    description: 'Decorative elements for outdoor spaces',
    category: 'decor',
    teaser: "We'll create: 'Summer garden decorating' + 4 design pieces"
  },
  {
    id: 'herb-garden',
    title: 'Summer Herb Garden',
    description: 'Growing and using fresh herbs in summer',
    category: 'plant_care',
    teaser: "We'll create: 'Summer herb gardening' + 4 growing pieces"
  }
];

export const useFocusThemes = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [themes, setThemes] = useState<FocusTheme[]>([]);
  const [filters, setFilters] = useState<ThemeFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadThemes();
      loadFilters();
    }
  }, [user, tenant]);

  const loadThemes = async () => {
    try {
      // Fetch theme status from database
      const { data: statusData } = await supabase
        .from('user_theme_status')
        .select('theme_id, status')
        .eq('user_id', user?.id)
        .eq('tenant_id', tenant?.id || null);

      const statusMap = new Map(statusData?.map(s => [s.theme_id, s.status]) || []);

      // Combine sample themes with status
      const themesWithStatus = SAMPLE_THEMES.map(theme => ({
        ...theme,
        status: statusMap.get(theme.id) || null
      }));

      setThemes(themesWithStatus);
    } catch (error) {
      console.error('Error loading themes:', error);
      setThemes(SAMPLE_THEMES);
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = () => {
    const saved = localStorage.getItem(`focus-filters-${tenant?.id || 'default'}`);
    if (saved) {
      try {
        setFilters(JSON.parse(saved));
      } catch {
        setFilters(DEFAULT_FILTERS);
      }
    }
  };

  const updateFilters = (newFilters: ThemeFilters) => {
    setFilters(newFilters);
    localStorage.setItem(`focus-filters-${tenant?.id || 'default'}`, JSON.stringify(newFilters));
  };

  const skipTheme = async (themeId: string) => {
    try {
      await supabase
        .from('user_theme_status')
        .upsert({
          user_id: user?.id,
          tenant_id: tenant?.id,
          theme_id: themeId,
          status: 'skipped',
          updated_at: new Date().toISOString()
        });

      // Update local state
      setThemes(prev => prev.map(theme => 
        theme.id === themeId ? { ...theme, status: 'skipped' } : theme
      ));
    } catch (error) {
      console.error('Error skipping theme:', error);
    }
  };

  const markGenerated = async (themeId: string) => {
    try {
      await supabase
        .from('user_theme_status')
        .upsert({
          user_id: user?.id,
          tenant_id: tenant?.id,
          theme_id: themeId,
          status: 'generated',
          updated_at: new Date().toISOString()
        });

      // Update local state
      setThemes(prev => prev.map(theme => 
        theme.id === themeId ? { ...theme, status: 'generated' } : theme
      ));
    } catch (error) {
      console.error('Error marking theme as generated:', error);
    }
  };

  // Filter themes based on current filters and exclude skipped ones
  const filteredThemes = themes.filter(theme => {
    if (theme.status === 'skipped') return false;
    return filters[theme.category];
  });

  return {
    themes: filteredThemes,
    filters,
    loading,
    updateFilters,
    skipTheme,
    markGenerated,
    refreshThemes: loadThemes
  };
};
