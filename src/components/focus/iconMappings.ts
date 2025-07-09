
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

  // Sale themes
  'summer-sale': {
    icon: Tag,
    color: '#EF4444',
    gradient: 'from-red-400 to-orange-500'
  },

  // Holiday themes
  'independence-day': {
    icon: Flag,
    color: '#DC2626',
    gradient: 'from-red-500 to-blue-600'
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

// Enhanced icon resolver for focus themes
export const getFocusThemeIcon = (theme: any): ThemeIconMapping => {
  // First try theme-specific mapping
  const themeMapping = THEME_ICON_MAPPINGS[theme.id];
  if (themeMapping) {
    return themeMapping;
  }

  // Fallback to category mapping
  const categoryMapping = CATEGORY_ICON_MAPPINGS[theme.category];
  if (categoryMapping) {
    return categoryMapping;
  }

  // Final fallback
  return {
    icon: Flower,
    color: '#68BEB9',
    gradient: 'from-teal-400 to-cyan-500'
  };
};
