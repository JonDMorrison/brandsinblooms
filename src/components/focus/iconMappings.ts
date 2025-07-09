
import { 
  Flower, 
  Sprout,
  Droplets,
  Palette,
  Sparkles,
  Calendar,
  Tag,
  Flag,
  Leaf,
  TreePine,
  Sun,
  Snowflake,
  Gift,
  Heart,
  Home,
  Scissors,
  Lightbulb,
  type LucideIcon
} from 'lucide-react';

export interface ThemeIconMapping {
  icon: LucideIcon;
  color: string;
  gradient?: string;
}

// Specific icon mappings for focus themes
export const THEME_ICON_MAPPINGS: Record<string, ThemeIconMapping> = {
  // Plant Care themes
  'summer-annuals': {
    icon: Sun,
    color: '#F59E0B',
    gradient: 'from-orange-400 to-yellow-500'
  },
  'drought-resistant': {
    icon: Droplets,
    color: '#0EA5E9',
    gradient: 'from-blue-400 to-cyan-500'
  },
  'herb-garden': {
    icon: Leaf,
    color: '#22C55E',
    gradient: 'from-green-400 to-emerald-500'
  },
  'spring-planting': {
    icon: Sprout,
    color: '#65A30D',
    gradient: 'from-lime-400 to-green-500'
  },
  'fall-cleanup': {
    icon: Scissors,
    color: '#D97706',
    gradient: 'from-amber-400 to-orange-500'
  },
  'winter-preparation': {
    icon: Snowflake,
    color: '#06B6D4',
    gradient: 'from-cyan-400 to-blue-500'
  },
  'pruning': {
    icon: Scissors,
    color: '#7C2D12',
    gradient: 'from-red-600 to-orange-700'
  },
  'fertilizing': {
    icon: Sparkles,
    color: '#059669',
    gradient: 'from-emerald-400 to-teal-500'
  },
  'composting': {
    icon: Leaf,
    color: '#16A34A',
    gradient: 'from-green-500 to-emerald-600'
  },

  // Decor themes
  'container-gardens': {
    icon: Home,
    color: '#8B5CF6',
    gradient: 'from-purple-400 to-violet-500'
  },
  'outdoor-decor': {
    icon: Palette,
    color: '#EC4899',
    gradient: 'from-pink-400 to-rose-500'
  },
  'garden-lighting': {
    icon: Lightbulb,
    color: '#FBBF24',
    gradient: 'from-yellow-400 to-amber-500'
  },
  'pathway-design': {
    icon: Home,
    color: '#6B7280',
    gradient: 'from-gray-400 to-slate-500'
  },

  // Sale themes
  'summer-sale': {
    icon: Tag,
    color: '#EF4444',
    gradient: 'from-red-400 to-orange-500'
  },
  'spring-sale': {
    icon: Tag,
    color: '#10B981',
    gradient: 'from-green-400 to-emerald-500'
  },
  'clearance': {
    icon: Tag,
    color: '#F59E0B',
    gradient: 'from-yellow-400 to-orange-500'
  },

  // Holiday themes
  'independence-day': {
    icon: Flag,
    color: '#DC2626',
    gradient: 'from-red-500 to-blue-600'
  },
  'halloween': {
    icon: TreePine,
    color: '#F97316',
    gradient: 'from-orange-500 to-red-600'
  },
  'thanksgiving': {
    icon: Leaf,
    color: '#D97706',
    gradient: 'from-amber-500 to-orange-600'
  },
  'christmas': {
    icon: TreePine,
    color: '#059669',
    gradient: 'from-green-500 to-red-500'
  },
  'valentine': {
    icon: Heart,
    color: '#E11D48',
    gradient: 'from-pink-500 to-red-500'
  },
  'easter': {
    icon: Flower,
    color: '#A855F7',
    gradient: 'from-purple-400 to-pink-500'
  },
  'mothers-day': {
    icon: Heart,
    color: '#EC4899',
    gradient: 'from-pink-400 to-rose-500'
  }
};

// Category-based fallback icons
export const CATEGORY_ICON_MAPPINGS: Record<string, ThemeIconMapping> = {
  plant_care: {
    icon: Sprout,
    color: '#22C55E',
    gradient: 'from-green-400 to-emerald-500'
  },
  decor: {
    icon: Sparkles,
    color: '#8B5CF6',
    gradient: 'from-purple-400 to-violet-500'
  },
  sale: {
    icon: Tag,
    color: '#EF4444',
    gradient: 'from-red-400 to-orange-500'
  },
  holidays: {
    icon: Calendar,
    color: '#3B82F6',
    gradient: 'from-blue-400 to-indigo-500'
  }
};

// Enhanced icon resolver for focus themes with improved fallback logic
export const getFocusThemeIcon = (theme: any): ThemeIconMapping => {
  // First try theme-specific mapping by id
  if (theme.id && THEME_ICON_MAPPINGS[theme.id]) {
    return THEME_ICON_MAPPINGS[theme.id];
  }

  // Try theme-specific mapping by title (lowercase, normalized)
  if (theme.title) {
    const normalizedTitle = theme.title.toLowerCase().replace(/\s+/g, '-');
    if (THEME_ICON_MAPPINGS[normalizedTitle]) {
      return THEME_ICON_MAPPINGS[normalizedTitle];
    }
  }

  // Enhanced keyword-based matching for variety
  if (theme.title || theme.description) {
    const searchText = `${theme.title || ''} ${theme.description || ''}`.toLowerCase();
    
    // Search for keywords in title/description to provide variety
    for (const [themeKey, mapping] of Object.entries(THEME_ICON_MAPPINGS)) {
      const keywords = themeKey.split('-');
      if (keywords.some(keyword => searchText.includes(keyword))) {
        return mapping;
      }
    }
  }

  // Week-based variation for themes without specific mappings
  if (theme.weekNumber) {
    const weekVariations: ThemeIconMapping[] = [
      { icon: Sprout, color: '#22C55E', gradient: 'from-green-400 to-emerald-500' },
      { icon: Leaf, color: '#16A34A', gradient: 'from-green-500 to-green-600' },
      { icon: TreePine, color: '#059669', gradient: 'from-emerald-500 to-teal-600' },
      { icon: Sun, color: '#F59E0B', gradient: 'from-yellow-400 to-orange-500' },
      { icon: Flower, color: '#68BEB9', gradient: 'from-teal-400 to-cyan-500' }
    ];
    return weekVariations[theme.weekNumber % weekVariations.length];
  }

  // Fallback to category mapping
  if (theme.category && CATEGORY_ICON_MAPPINGS[theme.category]) {
    return CATEGORY_ICON_MAPPINGS[theme.category];
  }

  // Final fallback
  return {
    icon: Flower,
    color: '#68BEB9',
    gradient: 'from-teal-400 to-cyan-500'
  };
};
