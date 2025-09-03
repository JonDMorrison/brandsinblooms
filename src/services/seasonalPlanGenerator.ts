import { getSeasonalTemplates } from '@/utils/seasonalTemplateService';
import { getFallbackThemes } from '@/utils/fallbackThemes';
import { getCurrentWeekNumber } from '@/utils/dateUtils';
import { PlanItem } from '@/components/plan/constants';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';

// Simple title sanitizer to remove week references
const sanitizeTitle = (title: string): string => {
  if (!title) return title;
  
  return title
    .replace(/Week\s+\d+\s*[-:]\s*/gi, '')
    .replace(/\s*[-:]\s*Week\s+\d+/gi, '')
    .replace(/Week\s+\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export interface SeasonalPlanTheme {
  id: string;
  label: string;
  description: string;
  seasonal_focus?: string;
  content_ideas?: string[];
}

// Get seasonal themes for a specific month
export const getSeasonalThemesForMonth = async (month: string): Promise<SeasonalPlanTheme[]> => {
  const monthDate = new Date(month);
  
  try {
    // First try to get seasonal templates from database
    const seasonalTemplates = await getSeasonalTemplates();
    
    if (seasonalTemplates.length > 0) {
      // Convert seasonal templates to plan themes
      return seasonalTemplates.slice(0, 6).map((template, index) => ({
        id: template.id,
        label: sanitizeTitle(template.title),
        description: template.seasonal_focus || template.theme || 'Seasonal marketing content',
        seasonal_focus: template.seasonal_focus,
        content_ideas: Array.isArray(template.content_ideas) ? template.content_ideas : []
      }));
    }
    
    // Fallback to static seasonal themes based on month
    const fallbackThemes = getFallbackThemes();
    return fallbackThemes.map((theme, index) => ({
      id: `seasonal-${index}`,
      label: sanitizeTitle(theme.title),
      description: theme.description,
      content_ideas: theme.content_ideas
    }));
    
  } catch (error) {
    console.error('Error fetching seasonal themes:', error);
    
    // Final fallback to month-based themes
    return getMonthBasedThemes(monthDate);
  }
};

// Generate seasonal content for the selected theme and month
export const generateSeasonalPlanContent = async (
  theme: SeasonalPlanTheme, 
  month: string
): Promise<PlanItem[]> => {
  const monthDate = new Date(month);
  const monthName = monthDate.toLocaleString('default', { month: 'long' });
  const year = monthDate.getFullYear();
  
  // Get week dates for the month
  const firstDay = new Date(year, monthDate.getMonth(), 1);
  const week1 = new Date(firstDay.getTime() + (7 * 24 * 60 * 60 * 1000));
  const week2 = new Date(firstDay.getTime() + (14 * 24 * 60 * 60 * 1000));
  const week3 = new Date(firstDay.getTime() + (21 * 24 * 60 * 60 * 1000));
  const week4 = new Date(Math.min(firstDay.getTime() + (28 * 24 * 60 * 60 * 1000), new Date(year, monthDate.getMonth() + 1, 0).getTime()));

  // Fetch holidays for the month to enrich content
  const holidays = await getHolidaysForMonth(monthDate);
  
  // Generate content ideas based on seasonal focus and content ideas
  const contentIdeas = theme.content_ideas || [];
  const seasonalFocus = theme.seasonal_focus || '';
  
  const items: PlanItem[] = [
    // Email items with seasonal content
    {
      id: `email-1-${Date.now()}`,
      type: 'email',
      title: `${sanitizeTitle(theme.label)} Newsletter - ${monthName} Tips`,
      caption: generateSeasonalEmailContent(theme, monthName, seasonalFocus, contentIdeas[0], holidays),
      date: week1,
      enabled: true,
      week: 1
    },
    {
      id: `email-2-${Date.now() + 1}`,
      type: 'email',
      title: `${monthName} ${sanitizeTitle(theme.label)} Special`,
      caption: generatePromotionalContent(theme, monthName, seasonalFocus, holidays),
      date: week3,
      enabled: true,
      week: 3
    },
    
    // SMS items with seasonal urgency
    {
      id: `sms-1-${Date.now() + 2}`,
      type: 'sms',
      title: `${monthName} ${sanitizeTitle(theme.label)} Workshop`,
      caption: generateSMSContent(theme, monthName, seasonalFocus, 'workshop'),
      date: week2,
      enabled: true,
      week: 2
    },
    {
      id: `sms-2-${Date.now() + 3}`,
      type: 'sms',
      title: `${monthName} ${sanitizeTitle(theme.label)} Final Days`,
      caption: generateSMSContent(theme, monthName, seasonalFocus, 'urgency'),
      date: week4,
      enabled: true,
      week: 4
    },
    
    // Facebook posts with seasonal engagement
    {
      id: `facebook-1-${Date.now() + 4}`,
      type: 'facebook',
      title: `${monthName} ${sanitizeTitle(theme.label)} Monday Tips`,
      caption: generateSocialContent(theme, monthName, seasonalFocus, contentIdeas[1], 'facebook'),
      date: new Date(firstDay.getTime() + (3 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 1
    },
    {
      id: `facebook-2-${Date.now() + 5}`,
      type: 'facebook',
      title: `${monthName} ${sanitizeTitle(theme.label)} Feature Friday`,
      caption: generateSocialContent(theme, monthName, seasonalFocus, contentIdeas[2], 'facebook', 'friday'),
      date: new Date(week1.getTime() + (4 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 1
    },
    {
      id: `facebook-3-${Date.now() + 6}`,
      type: 'facebook',
      title: `${sanitizeTitle(theme.label)} Workshop - This Weekend`,
      caption: generateWorkshopContent(theme, monthName, seasonalFocus),
      date: new Date(week2.getTime() - (2 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 2
    },
    
    // Instagram posts with visual focus
    {
      id: `instagram-1-${Date.now() + 7}`,
      type: 'instagram',
      title: `${monthName} ${sanitizeTitle(theme.label)} Inspiration`,
      caption: generateInstagramContent(theme, monthName, seasonalFocus, contentIdeas[0]),
      date: new Date(firstDay.getTime() + (5 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 1
    },
    {
      id: `instagram-2-${Date.now() + 8}`,
      type: 'instagram',
      title: `Behind the Scenes: ${sanitizeTitle(theme.label)}`,
      caption: generateBehindScenesContent(theme, monthName, seasonalFocus),
      date: new Date(week2.getTime() + (1 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 2
    },
    {
      id: `instagram-3-${Date.now() + 9}`,
      type: 'instagram',
      title: `Customer Success: ${sanitizeTitle(theme.label)}`,
      caption: generateCustomerSpotlightContent(theme, monthName),
      date: new Date(week3.getTime() + (3 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 3
    },
    {
      id: `instagram-4-${Date.now() + 10}`,
      type: 'instagram',
      title: `${monthName} ${sanitizeTitle(theme.label)} Transformation`,
      caption: generateTransformationContent(theme, monthName, seasonalFocus),
      date: new Date(week4.getTime()),
      enabled: true,
      week: 4
    }
  ];

  return items;
};

// Get holidays for a specific month
const getHolidaysForMonth = async (monthDate: Date) => {
  try {
    const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    
    const { data: holidays } = await supabase
      .from('holidays')
      .select('*')
      .gte('holiday_date', startDate.toISOString().split('T')[0])
      .lte('holiday_date', endDate.toISOString().split('T')[0])
      .eq('is_active', true);
      
    return holidays || [];
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
};

// Content generators with seasonal awareness
const generateSeasonalEmailContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, contentIdea?: string, holidays?: any[]) => {
  const holidayContext = holidays && holidays.length > 0 ? ` Perfect timing for ${holidays[0].holiday_name}!` : '';
  const focus = seasonalFocus || contentIdea || 'seasonal gardening';
  
  return `Welcome to ${month}! This is the perfect time for ${focus.toLowerCase()}. ${holidayContext} Get expert tips, seasonal plant recommendations, and exclusive offers tailored to this month's gardening opportunities. Don't miss our carefully curated selection perfect for ${month} conditions.`;
};

const generatePromotionalContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, holidays?: any[]) => {
  const holidayOffer = holidays && holidays.length > 0 ? ` ${holidays[0].holiday_name} Special:` : '';
  return `🌱${holidayOffer} ${month} ${theme.label} Sale! Save on everything you need for ${seasonalFocus.toLowerCase() || 'seasonal gardening'}. Limited time offers on featured plants, tools, and supplies. Perfect timing for ${month} planting and care.`;
};

const generateSMSContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, type: 'workshop' | 'urgency') => {
  if (type === 'workshop') {
    return `🌿 ${month} ${theme.label} Workshop this weekend! Learn seasonal techniques perfect for this time of year. Register now!`;
  }
  return `⏰ Final days! ${month} ${theme.label} promotion ends soon. Don't miss out on seasonal favorites. Shop now!`;
};

const generateSocialContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, contentIdea?: string, platform?: string, timing?: string) => {
  const focus = contentIdea || seasonalFocus || 'seasonal gardening';
  const timeContext = timing === 'friday' ? 'Feature Friday: ' : '';
  
  return `${timeContext}${month} is perfect for ${focus.toLowerCase()}! 🌿 ${platform === 'facebook' ? 'Share your progress with us and tag friends who love gardening!' : ''} #${month}Gardening #${theme.id.replace(/[^a-zA-Z]/g, '')}`;
};

const generateInstagramContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, contentIdea?: string) => {
  const focus = contentIdea || seasonalFocus || 'seasonal inspiration';
  return `${month} ${focus.toLowerCase()} is here! ✨ Swipe for seasonal tips and inspiration. What's growing in your garden this month? #${month}Garden #SeasonalGardening #PlantLife`;
};

const generateBehindScenesContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string) => {
  return `Behind the scenes: Getting ready for ${month} ${theme.label.toLowerCase()}! 🎬 Our team's seasonal picks and preparation tips. See what we're excited about this month!`;
};

const generateCustomerSpotlightContent = (theme: SeasonalPlanTheme, month: string) => {
  return `Customer spotlight! 🌟 Amazing ${month} ${theme.label.toLowerCase()} results from our community. Tag us @YourGardenCenter to be featured! #CustomerSuccess #${month}Results`;
};

const generateTransformationContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string) => {
  return `${month} transformation magic! 🌱➡️🌺 See what's possible with the right seasonal care. What will you transform this ${month}? #BeforeAndAfter #${month}Transformation`;
};

const generateWorkshopContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string) => {
  return `Join us this weekend for hands-on ${theme.label.toLowerCase()} activities! 🛠️ Perfect for ${month} conditions. Learn seasonal techniques from our experts. Great for all skill levels!`;
};

// Fallback themes based on month when no templates are available
const getMonthBasedThemes = (monthDate: Date): SeasonalPlanTheme[] => {
  const month = monthDate.getMonth();
  
  if (month >= 2 && month <= 4) {
    // Spring themes
    return [
      { id: 'spring-planting', label: 'Spring Planting', description: 'Early season planting and garden preparation' },
      { id: 'seed-starting', label: 'Seed Starting', description: 'Indoor seed starting and transplant preparation' },
      { id: 'spring-cleanup', label: 'Spring Cleanup', description: 'Garden cleanup and soil preparation' }
    ];
  } else if (month >= 5 && month <= 7) {
    // Summer themes  
    return [
      { id: 'summer-care', label: 'Summer Care', description: 'Heat protection and summer plant care' },
      { id: 'watering-tips', label: 'Watering Tips', description: 'Efficient watering and irrigation systems' },
      { id: 'harvest-time', label: 'Harvest Time', description: 'Harvesting and preserving summer crops' }
    ];
  } else if (month >= 8 && month <= 10) {
    // Fall themes
    return [
      { id: 'fall-planting', label: 'Fall Planting', description: 'Fall planting and winter preparation' },
      { id: 'fall-cleanup', label: 'Fall Cleanup', description: 'Garden cleanup and winterizing' },
      { id: 'bulb-planting', label: 'Bulb Planting', description: 'Spring bulb planting for next year' }
    ];
  } else {
    // Winter themes
    return [
      { id: 'houseplant-month', label: 'Houseplant Care', description: 'Indoor plant care and winter gardening' },
      { id: 'holiday-plants', label: 'Holiday Plants', description: 'Holiday plant care and gift ideas' },
      { id: 'winter-planning', label: 'Winter Planning', description: 'Planning next year\'s garden' }
    ];
  }
};