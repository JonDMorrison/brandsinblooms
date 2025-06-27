import { 
  Leaf, 
  Flower, 
  TreePine, 
  Sprout,
  Activity,
  Dumbbell,
  Heart,
  ChefHat,
  UtensilsCrossed,
  Coffee,
  Camera,
  Palette,
  Brush,
  ShoppingBag,
  Store,
  TrendingUp,
  Mail,
  FileText,
  Video,
  Instagram,
  Facebook,
  Calendar,
  Target,
  Sparkles,
  Sun,
  Snowflake,
  Gift,
  Home,
  Car,
  Briefcase,
  Book,
  Music,
  Gamepad2,
  Plane,
  MapPin,
  type LucideIcon
} from 'lucide-react';

interface IconMapping {
  keywords: string[];
  icon: LucideIcon;
  color: string;
}

const ICON_MAPPINGS: IconMapping[] = [
  // Gardening & Plants
  { keywords: ['garden', 'plant', 'flower', 'bloom', 'nursery', 'landscaping', 'botanical'], icon: Flower, color: '#22C55E' },
  { keywords: ['tree', 'forest', 'pine', 'evergreen', 'lumber'], icon: TreePine, color: '#059669' },
  { keywords: ['seed', 'sprout', 'grow', 'cultivation', 'organic'], icon: Sprout, color: '#65A30D' },
  { keywords: ['leaf', 'foliage', 'green', 'nature'], icon: Leaf, color: '#16A34A' },
  
  // Fitness & Health
  { keywords: ['fitness', 'gym', 'workout', 'exercise', 'training'], icon: Dumbbell, color: '#DC2626' },
  { keywords: ['health', 'wellness', 'medical', 'care'], icon: Heart, color: '#E11D48' },
  { keywords: ['activity', 'sport', 'active', 'movement'], icon: Activity, color: '#EA580C' },
  
  // Food & Cooking
  { keywords: ['cooking', 'chef', 'kitchen', 'recipe', 'culinary'], icon: ChefHat, color: '#7C2D12' },
  { keywords: ['restaurant', 'dining', 'food', 'meal'], icon: UtensilsCrossed, color: '#A16207' },
  { keywords: ['coffee', 'cafe', 'beverage', 'drink'], icon: Coffee, color: '#92400E' },
  
  // Creative & Arts
  { keywords: ['photography', 'photo', 'camera', 'visual'], icon: Camera, color: '#7C3AED' },
  { keywords: ['art', 'design', 'creative', 'artistic'], icon: Palette, color: '#C026D3' },
  { keywords: ['paint', 'painting', 'brush', 'canvas'], icon: Brush, color: '#DB2777' },
  
  // Business & Retail
  { keywords: ['shop', 'shopping', 'retail', 'store', 'ecommerce'], icon: ShoppingBag, color: '#2563EB' },
  { keywords: ['business', 'company', 'corporate', 'professional'], icon: Briefcase, color: '#1D4ED8' },
  { keywords: ['sales', 'marketing', 'growth', 'revenue'], icon: TrendingUp, color: '#0891B2' },
  
  // Content Types
  { keywords: ['newsletter', 'email', 'communication'], icon: Mail, color: '#0284C7' },
  { keywords: ['blog', 'article', 'writing', 'content'], icon: FileText, color: '#0F766E' },
  { keywords: ['video', 'youtube', 'streaming'], icon: Video, color: '#DC2626' },
  { keywords: ['instagram', 'social media', 'ig'], icon: Instagram, color: '#E1306C' },
  { keywords: ['facebook', 'fb', 'meta'], icon: Facebook, color: '#1877F2' },
  
  // Seasonal & Events
  { keywords: ['summer', 'sun', 'sunny', 'hot'], icon: Sun, color: '#F59E0B' },
  { keywords: ['winter', 'snow', 'cold', 'holiday'], icon: Snowflake, color: '#06B6D4' },
  { keywords: ['gift', 'present', 'celebration', 'party'], icon: Gift, color: '#DC2626' },
  { keywords: ['calendar', 'event', 'schedule'], icon: Calendar, color: '#7C3AED' },
  
  // Other Industries
  { keywords: ['home', 'house', 'interior', 'decor'], icon: Home, color: '#059669' },
  { keywords: ['automotive', 'car', 'vehicle', 'auto'], icon: Car, color: '#374151' },
  { keywords: ['education', 'school', 'learning', 'book'], icon: Book, color: '#7C2D12' },
  { keywords: ['music', 'audio', 'sound', 'musician'], icon: Music, color: '#7C3AED' },
  { keywords: ['gaming', 'game', 'esports'], icon: Gamepad2, color: '#DC2626' },
  { keywords: ['travel', 'vacation', 'trip', 'tourism'], icon: Plane, color: '#0284C7' },
  { keywords: ['location', 'place', 'local', 'community'], icon: MapPin, color: '#DC2626' }
];

export const getDynamicIcon = (campaign: any, companyProfile?: any): { icon: LucideIcon; color: string } => {
  // Combine text sources for analysis
  const textSources = [
    campaign?.title || '',
    campaign?.description || '',
    campaign?.theme || '',
    companyProfile?.company_name || '',
    companyProfile?.company_overview || '',
    companyProfile?.specializations?.join(' ') || ''
  ].join(' ').toLowerCase();

  // Find the best matching icon based on keywords
  for (const mapping of ICON_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (textSources.includes(keyword)) {
        return { icon: mapping.icon, color: mapping.color };
      }
    }
  }

  // Seasonal fallback based on current month
  const currentMonth = new Date().getMonth();
  if (currentMonth >= 5 && currentMonth <= 7) { // Summer
    return { icon: Sun, color: '#F59E0B' };
  } else if (currentMonth >= 11 || currentMonth <= 1) { // Winter
    return { icon: Snowflake, color: '#06B6D4' };
  } else if (currentMonth >= 2 && currentMonth <= 4) { // Spring
    return { icon: Sprout, color: '#65A30D' };
  } else { // Fall
    return { icon: Leaf, color: '#DC2626' };
  }
};

export const getIconForContentType = (postType: string): { icon: LucideIcon; color: string } => {
  switch (postType) {
    case 'instagram':
      return { icon: Instagram, color: '#E1306C' };
    case 'facebook':
      return { icon: Facebook, color: '#1877F2' };
    case 'newsletter':
    case 'email':
      return { icon: Mail, color: '#0284C7' };
    case 'blog':
      return { icon: FileText, color: '#0F766E' };
    case 'video':
      return { icon: Video, color: '#DC2626' };
    default:
      return { icon: Target, color: '#68BEB9' };
  }
};
