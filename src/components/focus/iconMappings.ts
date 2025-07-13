
import { 
  Flower, 
  Flower2,
  Sprout,
  Droplets,
  Palette,
  Sparkles,
  Calendar,
  Tag,
  Flag,
  Leaf,
  TreePine,
  TreeDeciduous,
  TreePalm,
  Sun,
  SunSnow,
  Snowflake,
  Gift,
  Heart,
  Home,
  Scissors,
  Lightbulb,
  Shovel,
  Hammer,
  Wrench,
  Star,
  Award,
  Trophy,
  Target,
  Umbrella,
  Cloud,
  CloudRain,
  Wind,
  Rainbow,
  Pickaxe,
  Wheat,
  Apple,
  Cherry,
  Grape,
  Carrot,
  type LucideIcon
} from 'lucide-react';

export interface ThemeIconMapping {
  icon: LucideIcon;
  color: string;
  gradient?: string;
}

// Seasonal icon pools for randomization
export const SEASONAL_ICON_POOLS = {
  spring: [
    { icon: Flower, color: '#F472B6', gradient: 'from-pink-400 to-rose-500' },
    { icon: Flower2, color: '#A855F7', gradient: 'from-purple-400 to-pink-500' },
    { icon: Sprout, color: '#22C55E', gradient: 'from-green-400 to-emerald-500' },
    { icon: TreeDeciduous, color: '#10B981', gradient: 'from-emerald-400 to-green-500' },
    { icon: Leaf, color: '#16A34A', gradient: 'from-green-500 to-emerald-600' }
  ],
  summer: [
    { icon: Sun, color: '#F59E0B', gradient: 'from-yellow-400 to-orange-500' },
    { icon: TreePalm, color: '#06B6D4', gradient: 'from-cyan-400 to-blue-500' },
    { icon: Droplets, color: '#0EA5E9', gradient: 'from-blue-400 to-cyan-500' },
    { icon: Rainbow, color: '#8B5CF6', gradient: 'from-purple-400 to-blue-500' },
    { icon: Target, color: '#EF4444', gradient: 'from-red-400 to-pink-500' }
  ],
  fall: [
    { icon: TreeDeciduous, color: '#F97316', gradient: 'from-orange-400 to-red-500' },
    { icon: Wheat, color: '#CA8A04', gradient: 'from-yellow-600 to-orange-600' },
    { icon: Apple, color: '#DC2626', gradient: 'from-red-500 to-orange-500' },
    { icon: Grape, color: '#7C3AED', gradient: 'from-purple-500 to-indigo-600' },
    { icon: Wind, color: '#64748B', gradient: 'from-slate-400 to-gray-500' }
  ],
  winter: [
    { icon: Snowflake, color: '#06B6D4', gradient: 'from-cyan-400 to-blue-500' },
    { icon: TreePine, color: '#059669', gradient: 'from-emerald-600 to-green-700' },
    { icon: SunSnow, color: '#3B82F6', gradient: 'from-blue-400 to-indigo-500' },
    { icon: Gift, color: '#DC2626', gradient: 'from-red-500 to-pink-500' },
    { icon: Star, color: '#F59E0B', gradient: 'from-yellow-400 to-amber-500' }
  ]
};

// Specific icon mappings for focus themes
export const THEME_ICON_MAPPINGS: Record<string, ThemeIconMapping> = {
  // Plant Care themes - Seasonal Plants
  'summer-annuals': { icon: Sun, color: '#F59E0B', gradient: 'from-orange-400 to-yellow-500' },
  'spring-bulbs': { icon: Flower2, color: '#A855F7', gradient: 'from-purple-400 to-pink-500' },
  'fall-planting': { icon: TreeDeciduous, color: '#F97316', gradient: 'from-orange-400 to-red-500' },
  'winter-care': { icon: Snowflake, color: '#06B6D4', gradient: 'from-cyan-400 to-blue-500' },
  
  // Plant Care - Types
  'herb-garden': { icon: Leaf, color: '#22C55E', gradient: 'from-green-400 to-emerald-500' },
  'vegetable-garden': { icon: Carrot, color: '#F97316', gradient: 'from-orange-400 to-amber-500' },
  'flower-beds': { icon: Flower, color: '#F472B6', gradient: 'from-pink-400 to-rose-500' },
  'fruit-trees': { icon: Apple, color: '#DC2626', gradient: 'from-red-500 to-orange-500' },
  'shade-plants': { icon: TreeDeciduous, color: '#10B981', gradient: 'from-emerald-400 to-green-500' },
  'drought-resistant': { icon: Droplets, color: '#0EA5E9', gradient: 'from-blue-400 to-cyan-500' },
  
  // Plant Care - Activities
  'pruning': { icon: Scissors, color: '#6B7280', gradient: 'from-gray-400 to-slate-500' },
  'fertilizing': { icon: Sprout, color: '#84CC16', gradient: 'from-lime-400 to-green-500' },
  'watering': { icon: Droplets, color: '#06B6D4', gradient: 'from-cyan-400 to-blue-500' },
  'planting': { icon: Shovel, color: '#A3A3A3', gradient: 'from-neutral-400 to-gray-500' },
  'harvesting': { icon: Wheat, color: '#CA8A04', gradient: 'from-yellow-600 to-orange-600' },
  
  // Decor themes
  'container-gardens': { icon: Home, color: '#8B5CF6', gradient: 'from-purple-400 to-violet-500' },
  'outdoor-decor': { icon: Palette, color: '#EC4899', gradient: 'from-pink-400 to-rose-500' },
  'garden-design': { icon: Star, color: '#F59E0B', gradient: 'from-yellow-400 to-amber-500' },
  'lighting': { icon: Lightbulb, color: '#FBBF24', gradient: 'from-amber-400 to-yellow-500' },
  'pathways': { icon: Target, color: '#6B7280', gradient: 'from-gray-400 to-slate-500' },
  'water-features': { icon: Droplets, color: '#0EA5E9', gradient: 'from-blue-400 to-cyan-500' },
  
  // Weather themes
  'rain-prep': { icon: CloudRain, color: '#64748B', gradient: 'from-slate-400 to-gray-500' },
  'wind-protection': { icon: Wind, color: '#6B7280', gradient: 'from-gray-400 to-slate-500' },
  'sun-protection': { icon: Umbrella, color: '#F59E0B', gradient: 'from-yellow-400 to-orange-500' },
  'storm-recovery': { icon: Cloud, color: '#64748B', gradient: 'from-slate-400 to-blue-500' },
  
  // Sale themes
  'summer-sale': { icon: Tag, color: '#EF4444', gradient: 'from-red-400 to-orange-500' },
  'spring-sale': { icon: Tag, color: '#22C55E', gradient: 'from-green-400 to-emerald-500' },
  'clearance': { icon: Tag, color: '#7C3AED', gradient: 'from-purple-500 to-indigo-600' },
  'new-arrivals': { icon: Star, color: '#F59E0B', gradient: 'from-yellow-400 to-amber-500' },
  'bulk-discount': { icon: Tag, color: '#DC2626', gradient: 'from-red-500 to-pink-500' },
  
  // Holiday themes
  'independence-day': { icon: Flag, color: '#DC2626', gradient: 'from-red-500 to-blue-600' },
  'mothers-day': { icon: Heart, color: '#F472B6', gradient: 'from-pink-400 to-rose-500' },
  'fathers-day': { icon: Award, color: '#3B82F6', gradient: 'from-blue-400 to-indigo-500' },
  'christmas': { icon: Gift, color: '#DC2626', gradient: 'from-red-500 to-green-600' },
  'thanksgiving': { icon: Wheat, color: '#CA8A04', gradient: 'from-yellow-600 to-orange-600' },
  'easter': { icon: Flower, color: '#A855F7', gradient: 'from-purple-400 to-pink-500' },
  'halloween': { icon: TreeDeciduous, color: '#F97316', gradient: 'from-orange-500 to-red-600' },
  
  // Tools & Equipment
  'tool-care': { icon: Hammer, color: '#6B7280', gradient: 'from-gray-400 to-slate-500' },
  'equipment-maintenance': { icon: Wrench, color: '#64748B', gradient: 'from-slate-400 to-gray-500' },
  'soil-preparation': { icon: Pickaxe, color: '#A3A3A3', gradient: 'from-neutral-400 to-stone-500' },
  
  // Achievement themes
  'garden-goals': { icon: Target, color: '#10B981', gradient: 'from-emerald-400 to-green-500' },
  'success-stories': { icon: Trophy, color: '#F59E0B', gradient: 'from-yellow-400 to-amber-500' },
  'before-after': { icon: Award, color: '#8B5CF6', gradient: 'from-purple-400 to-violet-500' }
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

// Get current season based on month
export const getCurrentSeason = (): keyof typeof SEASONAL_ICON_POOLS => {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'spring'; // Mar-May
  if (month >= 5 && month <= 7) return 'summer'; // Jun-Aug
  if (month >= 8 && month <= 10) return 'fall'; // Sep-Nov
  return 'winter'; // Dec-Feb
};

// Enhanced keyword detection for better categorization
export const detectThemeFromContent = (theme: any): ThemeIconMapping | null => {
  const content = `${theme.title || ''} ${theme.description || ''} ${theme.teaser || ''}`.toLowerCase();
  
  // Plant types
  if (content.includes('herb') || content.includes('basil') || content.includes('mint')) 
    return THEME_ICON_MAPPINGS['herb-garden'];
  if (content.includes('vegetable') || content.includes('tomato') || content.includes('carrot')) 
    return THEME_ICON_MAPPINGS['vegetable-garden'];
  if (content.includes('flower') || content.includes('bloom') || content.includes('rose')) 
    return THEME_ICON_MAPPINGS['flower-beds'];
  if (content.includes('fruit') || content.includes('apple') || content.includes('tree')) 
    return THEME_ICON_MAPPINGS['fruit-trees'];
    
  // Activities
  if (content.includes('prune') || content.includes('trim') || content.includes('cut')) 
    return THEME_ICON_MAPPINGS['pruning'];
  if (content.includes('fertilize') || content.includes('feed') || content.includes('nutrition')) 
    return THEME_ICON_MAPPINGS['fertilizing'];
  if (content.includes('water') || content.includes('irrigation') || content.includes('moisture')) 
    return THEME_ICON_MAPPINGS['watering'];
  if (content.includes('plant') || content.includes('seed') || content.includes('sow')) 
    return THEME_ICON_MAPPINGS['planting'];
  if (content.includes('harvest') || content.includes('pick') || content.includes('gather')) 
    return THEME_ICON_MAPPINGS['harvesting'];
    
  // Weather
  if (content.includes('drought') || content.includes('dry') || content.includes('water-wise')) 
    return THEME_ICON_MAPPINGS['drought-resistant'];
  if (content.includes('rain') || content.includes('wet') || content.includes('storm')) 
    return THEME_ICON_MAPPINGS['rain-prep'];
  if (content.includes('wind') || content.includes('protect')) 
    return THEME_ICON_MAPPINGS['wind-protection'];
    
  // Seasonal
  if (content.includes('spring') || content.includes('bulb')) 
    return THEME_ICON_MAPPINGS['spring-bulbs'];
  if (content.includes('summer') || content.includes('heat')) 
    return THEME_ICON_MAPPINGS['summer-annuals'];
  if (content.includes('fall') || content.includes('autumn')) 
    return THEME_ICON_MAPPINGS['fall-planting'];
  if (content.includes('winter') || content.includes('cold')) 
    return THEME_ICON_MAPPINGS['winter-care'];
    
  // Design & Decor
  if (content.includes('design') || content.includes('landscape')) 
    return THEME_ICON_MAPPINGS['garden-design'];
  if (content.includes('container') || content.includes('pot')) 
    return THEME_ICON_MAPPINGS['container-gardens'];
  if (content.includes('light') || content.includes('lighting')) 
    return THEME_ICON_MAPPINGS['lighting'];
    
  // Sales & Promotions
  if (content.includes('sale') || content.includes('discount') || content.includes('promo')) 
    return THEME_ICON_MAPPINGS['summer-sale'];
  if (content.includes('new') || content.includes('arrival')) 
    return THEME_ICON_MAPPINGS['new-arrivals'];
  if (content.includes('clear') || content.includes('bulk')) 
    return THEME_ICON_MAPPINGS['clearance'];
    
  return null;
};

// Get deterministic icon from seasonal pool using theme ID hash
export const getSeasonalIcon = (themeId: string, season?: keyof typeof SEASONAL_ICON_POOLS): ThemeIconMapping => {
  const currentSeason = season || getCurrentSeason();
  const pool = SEASONAL_ICON_POOLS[currentSeason];
  
  // Create a simple hash from theme ID for consistent selection
  let hash = 0;
  for (let i = 0; i < themeId.length; i++) {
    const char = themeId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const index = Math.abs(hash) % pool.length;
  return pool[index];
};

// Enhanced icon resolver for focus themes
export const getFocusThemeIcon = (theme: any): ThemeIconMapping => {
  // Ensure we have a stable theme identifier
  const themeId = theme.id || theme.title || 'default';
  
  // First try exact theme ID mapping
  const themeMapping = THEME_ICON_MAPPINGS[themeId];
  if (themeMapping) {
    return themeMapping;
  }

  // Try content-based detection
  const contentMapping = detectThemeFromContent(theme);
  if (contentMapping) {
    return contentMapping;
  }

  // Enhanced category mapping with seasonal variation
  if (theme.category) {
    const categoryBase = CATEGORY_ICON_MAPPINGS[theme.category];
    if (categoryBase) {
      // For plant_care category, use deterministic seasonal icons
      if (theme.category === 'plant_care') {
        return getSeasonalIcon(themeId);
      }
      return categoryBase;
    }
  }

  // Final fallback: deterministic seasonal icon based on theme ID
  return getSeasonalIcon(themeId);
};
