import { getSeasonalTemplates } from '@/utils/seasonalTemplateService';
import { getFallbackThemes } from '@/utils/fallbackThemes';
import { getCurrentWeekNumber, parseMonthParam, getMonthWeekNumbers } from '@/utils/dateUtils';
import { PlanItem } from '@/components/plan/constants';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';
import { batchGenerateEmails } from './emailContentService';
import { generateEnhancedBlogContent } from './blogContentGenerator';
import { mediaSelector } from '@/utils/mediaSelector';
import { buildSeasonalImageQuery } from '@/utils/seasonalImageQueryBuilder';
import { SequentialImageLoader } from '@/services/SequentialImageLoader';

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
export const getSeasonalThemesForMonth = async (month: string, offset = 0, limit = 6): Promise<{ themes: SeasonalPlanTheme[], hasMore: boolean }> => {
  const monthDate = parseMonthParam(month);
  const monthNumber = monthDate.getMonth() + 1; // 1-12
  
  try {
    // Get week numbers for the selected month using accurate ISO week calculation
    const monthWeeks = getMonthWeekNumbers(monthDate);
    
    // Fetch seasonal templates for this month's weeks
    const { data: seasonalTemplates, error } = await supabase
      .from('master_campaign_templates')
      .select('*')
      .in('week_number', monthWeeks)
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    let themes: SeasonalPlanTheme[] = [];
    let hasMore = false;
    
    if (seasonalTemplates && seasonalTemplates.length > 0) {
      // Convert seasonal templates to plan themes
      themes = seasonalTemplates.map((template) => ({
        id: template.id,
        label: sanitizeTitle(template.title),
        description: template.seasonal_focus || template.theme || 'Seasonal marketing content',
        seasonal_focus: template.seasonal_focus,
        content_ideas: Array.isArray(template.content_ideas) ? template.content_ideas : []
      }));
      
      // Check if there are more themes
      const { count } = await supabase
        .from('master_campaign_templates')
        .select('*', { count: 'exact', head: true })
        .in('week_number', monthWeeks);
      
      hasMore = count ? count > offset + limit : false;
    }
    
    // If no themes from DB or this is the first load, add fallback themes
    if (themes.length === 0 || offset === 0) {
      const fallbackThemes = getMonthBasedThemes(monthDate);
      const holidayThemes = getHolidayThemesForMonth(monthNumber);
      
      // Add month-specific themes first
      const monthSpecificThemes = [...fallbackThemes, ...holidayThemes].map((theme, index) => ({
        id: `theme-${monthNumber}-${index}`,
        label: theme.label,
        description: theme.description,
        content_ideas: theme.content_ideas || []
      }));
      
      // Combine with database themes, removing duplicates
      const allThemes = [...themes, ...monthSpecificThemes];
      const uniqueThemes = allThemes.filter((theme, index, arr) => 
        arr.findIndex(t => t.label.toLowerCase() === theme.label.toLowerCase()) === index
      );
      
      themes = uniqueThemes.slice(0, limit);
      hasMore = uniqueThemes.length > limit || hasMore;
    }
    
    return { themes, hasMore };
    
  } catch (error) {
    console.error('Error fetching seasonal themes:', error);
    
    // Final fallback to month-based themes
    const fallbackThemes = getMonthBasedThemes(monthDate);
    const holidayThemes = getHolidayThemesForMonth(monthNumber);
    
    const themes = [...fallbackThemes, ...holidayThemes].map((theme, index) => ({
      id: `fallback-${monthNumber}-${index}`,
      label: theme.label,
      description: theme.description,
      content_ideas: theme.content_ideas || []
    }));
    
    return { 
      themes: themes.slice(offset, offset + limit), 
      hasMore: themes.length > offset + limit 
    };
  }
};

// Generate seasonal content for multiple themes and month
export const generateMultiThemeSeasonalPlanContent = async (
  themes: SeasonalPlanTheme[], 
  month: string
): Promise<PlanItem[]> => {
  if (themes.length === 0) return [];
  
  let allItems: PlanItem[] = [];
  
  // Generate content for primary theme (first theme gets all 4 weeks)
  const primaryTheme = themes[0];
  const primaryItems = await generateSeasonalPlanContent(primaryTheme, month);
  
  // Add theme information to primary items
  const primaryItemsWithTheme = primaryItems.map(item => ({
    ...item,
    themeId: primaryTheme.id,
    themeName: primaryTheme.label
  }));
  
  allItems = [...primaryItemsWithTheme];
  
  // Generate overlay content for secondary themes (typically 1-2 weeks each)
  for (let i = 1; i < themes.length; i++) {
    const theme = themes[i];
    const overlayItems = await generateOverlayContent(theme, month, i + 1); // Start from week 2
    allItems = [...allItems, ...overlayItems];
  }
  
  // Generate enhanced email content using AI
  try {
    console.log('Enhancing email content with AI...');
    allItems = await batchGenerateEmails(allItems, month, themes);
  } catch (error) {
    console.error('Failed to enhance emails with AI, continuing with basic content:', error);
  }

  return allItems;
};

// Generate overlay content for secondary themes
const generateOverlayContent = async (
  theme: SeasonalPlanTheme,
  month: string,
  targetWeek: number
): Promise<PlanItem[]> => {
  const monthDate = parseMonthParam(month);
  const monthName = monthDate.toLocaleString('default', { month: 'long' });
  const year = monthDate.getFullYear();
  
  // Calculate target week date
  const firstDay = new Date(year, monthDate.getMonth(), 1);
  const weekDate = new Date(firstDay.getTime() + ((targetWeek - 1) * 7 * 24 * 60 * 60 * 1000));
  
  const contentIdeas = theme.content_ideas || [];
  const seasonalFocus = theme.seasonal_focus || '';
  
  const items: PlanItem[] = [
    // Email overlay
    {
      id: `email-overlay-${theme.id}-${Date.now()}`,
      type: 'email',
      title: `${sanitizeTitle(theme.label)} Special - ${monthName}`,
      caption: generateSeasonalEmailContent(theme, monthName, seasonalFocus, contentIdeas[0]),
      date: weekDate,
      enabled: true,
      week: targetWeek,
      themeId: theme.id,
      themeName: theme.label
    },
    // Social overlay
    {
      id: `facebook-overlay-${theme.id}-${Date.now()}`,
      type: 'facebook',
      title: `${sanitizeTitle(theme.label)} Feature`,
      caption: generateSocialContent(theme, monthName, seasonalFocus, contentIdeas[0], 'facebook'),
      date: new Date(weekDate.getTime() + (2 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: targetWeek,
      themeId: theme.id,
      themeName: theme.label
    },
    {
      id: `instagram-overlay-${theme.id}-${Date.now()}`,
      type: 'instagram',
      title: `${sanitizeTitle(theme.label)} Story`,
      caption: generateInstagramContent(theme, monthName, seasonalFocus, contentIdeas[0]),
      date: new Date(weekDate.getTime() + (3 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: targetWeek,
      themeId: theme.id,
      themeName: theme.label
    }
  ];
  
  // Images will be generated by AI after plan is launched
  // No longer using Unsplash preview images
  
  return items;
};

// Generate seasonal content for a single theme and month (used for primary theme)
export const generateSeasonalPlanContent = async (
  theme: SeasonalPlanTheme, 
  month: string
): Promise<PlanItem[]> => {
  const monthDate = parseMonthParam(month);
  const monthName = monthDate.toLocaleString('default', { month: 'long' });
  const year = monthDate.getFullYear();
  
  // Get week dates for the month
  const firstDay = new Date(year, monthDate.getMonth(), 1);
  const week1 = new Date(firstDay.getTime() + (7 * 24 * 60 * 60 * 1000));
  const week2 = new Date(firstDay.getTime() + (14 * 24 * 60 * 60 * 1000));
  const week3 = new Date(firstDay.getTime() + (21 * 24 * 60 * 60 * 1000));
  const week4 = new Date(Math.min(firstDay.getTime() + (28 * 24 * 60 * 60 * 1000), new Date(year, monthDate.getMonth() + 1, 0).getTime()));

  // Helpers to land on specific weekdays within a week block
  const dayMs = 24 * 60 * 60 * 1000;
  const fridayOfWeek2 = new Date(week2.getTime() + (((5 - week2.getDay() + 7) % 7) * dayMs)); // 5 = Friday
  const saturdayOfWeek3 = new Date(week3.getTime() + (((6 - week3.getDay() + 7) % 7) * dayMs)); // 6 = Saturday

  // Fetch holidays for the month to enrich content
  const holidays = await getHolidaysForMonth(monthDate);
  
  // Generate content ideas based on seasonal focus and content ideas
  const contentIdeas = theme.content_ideas || [];
  const seasonalFocus = theme.seasonal_focus || '';
  
  const items: PlanItem[] = [
    // Monthly blog post with enhanced content
    {
      id: `blog-1-${Date.now()}`,
      type: 'blog',
      title: `${monthName} ${sanitizeTitle(theme.label)} Guide`,
      caption: generateBlogContent(theme, monthName, seasonalFocus, contentIdeas[0], holidays),
      date: new Date(firstDay.getTime() + (5 * 24 * 60 * 60 * 1000)), // First Friday
      enabled: true,
      week: 1,
      // Enhanced blog content will be generated with image after auto-assign
      enhancedContent: generateEnhancedBlogContent(theme, monthName, seasonalFocus, contentIdeas[0], holidays, '')
    },
    
    // Email items with seasonal content
    {
      id: `email-1-${Date.now() + 1}`,
      type: 'email',
      title: `${sanitizeTitle(theme.label)} Newsletter - ${monthName} Tips`,
      caption: generateSeasonalEmailContent(theme, monthName, seasonalFocus, contentIdeas[0], holidays),
      date: week1,
      enabled: true,
      week: 1
    },
    {
      id: `email-2-${Date.now() + 2}`,
      type: 'email',
      title: `${monthName} ${sanitizeTitle(theme.label)} Special`,
      caption: generatePromotionalContent(theme, monthName, seasonalFocus, holidays),
      date: week3,
      enabled: true,
      week: 3
    },
    
    // SMS items with seasonal urgency
    {
      id: `sms-1-${Date.now() + 3}`,
      type: 'sms',
      title: `${monthName} ${sanitizeTitle(theme.label)} Workshop`,
      caption: generateSMSContent(theme, monthName, seasonalFocus, 'workshop'),
      date: week2,
      enabled: true,
      week: 2
    },
    {
      id: `sms-2-${Date.now() + 4}`,
      type: 'sms',
      title: `${monthName} ${sanitizeTitle(theme.label)} Final Days`,
      caption: generateSMSContent(theme, monthName, seasonalFocus, 'urgency'),
      date: week4,
      enabled: true,
      week: 4
    },
    
    // Facebook posts with seasonal engagement
    {
      id: `facebook-1-${Date.now() + 5}`,
      type: 'facebook',
      title: `${monthName} ${sanitizeTitle(theme.label)} Monday Tips`,
      caption: generateSocialContent(theme, monthName, seasonalFocus, contentIdeas[1], 'facebook'),
      date: new Date(firstDay.getTime() + (3 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 1
    },
    {
      id: `facebook-2-${Date.now() + 6}`,
      type: 'facebook',
      title: `${monthName} ${sanitizeTitle(theme.label)} Feature Friday`,
      caption: generateSocialContent(theme, monthName, seasonalFocus, contentIdeas[2], 'facebook', 'friday'),
      date: fridayOfWeek2,
      enabled: true,
      week: 2
    },
    {
      id: `facebook-3-${Date.now() + 7}`,
      type: 'facebook',
      title: `${sanitizeTitle(theme.label)} Workshop - This Weekend`,
      caption: generateWorkshopContent(theme, monthName, seasonalFocus),
      date: saturdayOfWeek3,
      enabled: true,
      week: 3
    },
    
    // Instagram posts with visual focus
    {
      id: `instagram-1-${Date.now() + 8}`,
      type: 'instagram',
      title: `${monthName} ${sanitizeTitle(theme.label)} Inspiration`,
      caption: generateInstagramContent(theme, monthName, seasonalFocus, contentIdeas[0]),
      date: new Date(firstDay.getTime() + (5 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 1
    },
    {
      id: `instagram-2-${Date.now() + 9}`,
      type: 'instagram',
      title: `Behind the Scenes: ${sanitizeTitle(theme.label)}`,
      caption: generateBehindScenesContent(theme, monthName, seasonalFocus),
      date: new Date(week2.getTime() + (1 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 2
    },
    {
      id: `instagram-3-${Date.now() + 10}`,
      type: 'instagram',
      title: `Customer Success: ${sanitizeTitle(theme.label)}`,
      caption: generateCustomerSpotlightContent(theme, monthName),
      date: new Date(week3.getTime() + (3 * 24 * 60 * 60 * 1000)),
      enabled: true,
      week: 3
    },
    {
      id: `instagram-4-${Date.now() + 11}`,
      type: 'instagram',
      title: `${monthName} ${sanitizeTitle(theme.label)} Transformation`,
      caption: generateTransformationContent(theme, monthName, seasonalFocus),
      date: new Date(week4.getTime()),
      enabled: true,
      week: 4
    }
  ];

  // Auto-generate unique images for each content type based on week position
  await autoAssignImages(items, monthName);

  return items;
};

// Auto-assign images to content items with time-aware queries and robust fallbacks
const autoAssignImages = async (items: PlanItem[], month: string) => {
  console.log(`[AutoImageAssignment] SKIPPED - AI generation now handles images`);
  // This function is disabled - AI generation now handles all image assignment
  return;
  
  /* DISABLED - AI generation now handles images
  console.log(`[AutoImageAssignment] Starting image assignment for ${items.length} items in ${month}`);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Only assign images to facebook, instagram, and blog
    if (!['facebook', 'instagram', 'blog'].includes(item.type)) {
      continue;
    }
    
    try {
      const weekNumber = item.week || 1;
      const themeContext = item.themeName || item.title;
      
      // Build time and content-type aware query
      const { query, altText } = buildSeasonalImageQuery(
        month,
        weekNumber,
        item.type as 'facebook' | 'instagram' | 'blog',
        themeContext
      );
      
      console.log(`[AutoImageAssignment] Trying ${item.type} week ${weekNumber} seasonal query: "${query}"`);
      
      // Fallback chain for robust image fetching
      let result = null;
      
      // Try 1: Seasonal query
      try {
        result = await mediaSelector({ prompt: query, count: 3 });
      } catch (err) {
        console.warn(`[AutoImageAssignment] Seasonal query failed:`, err);
      }
      
      // Try 2: Simplified query (just theme + month)
      if (!result?.url) {
        const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long' });
        const simpleQuery = `${themeContext.split(' ').slice(0, 2).join(' ')} ${monthName} garden`;
        console.log(`[AutoImageAssignment] Trying simplified query: "${simpleQuery}"`);
        
        try {
          result = await mediaSelector({ prompt: simpleQuery, count: 3 });
        } catch (err) {
          console.warn(`[AutoImageAssignment] Simplified query failed:`, err);
        }
      }
      
      // Try 3: Curated collection via Supabase function
      if (!result?.url) {
        console.log(`[AutoImageAssignment] Trying curated collection`);
        try {
          const { data: curatedData, error: curatedError } = await supabase.functions.invoke('fetch-unsplash-images', {
            body: { 
              collection: 'cfl9BkhJD2o',
              page: Math.floor(Math.random() * 3) + 1,
              maxImages: 12
            }
          });
          
          if (!curatedError && curatedData?.images && curatedData.images.length > 0) {
            const randomIndex = Math.floor(Math.random() * curatedData.images.length);
            const img = curatedData.images[randomIndex];
            result = {
              url: img.download_url,
              photographer: img.photographer,
              photographerUrl: img.photographer_url
            };
          }
        } catch (err) {
          console.warn(`[AutoImageAssignment] Curated collection failed:`, err);
        }
      }
      
      if (result?.url) {
        item.imageUrl = result.url;
        item.imageMetadata = {
          alt: altText,
          photographer: result.photographer,
          source: 'unsplash_auto'
        };
        
        // For blog posts, regenerate enhanced content with the image
        if (item.type === 'blog' && item.enhancedContent) {
          const theme = { label: item.title } as any;
          item.enhancedContent = generateEnhancedBlogContent(
            theme,
            month,
            themeContext,
            undefined,
            [],
            result.url
          );
        }
        
        console.log(`[AutoImageAssignment] ✓ Image assigned for ${item.type} week ${weekNumber}: ${item.imageUrl}`);
      } else {
        console.warn(`[AutoImageAssignment] ⚠ All fallbacks failed for ${item.type} week ${weekNumber}`);
      }
      
      // Add delay between requests to avoid rate limiting
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`[AutoImageAssignment] Failed to assign image for ${item.type}:`, error);
      // Continue with other items even if one fails
    }
  }
  
  console.log(`[AutoImageAssignment] Completed image assignment`);
  */
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
  const holidayOffer = holidays && holidays.length > 0 ? `${holidays[0].holiday_name} Special: ` : '';
  const focus = seasonalFocus || theme.label;
  
  return `${holidayOffer}${month} ${theme.label} Sale - Save on premium plants and expert supplies for ${focus.toLowerCase()}.  Limited-time pricing on seasonal favorites perfect for ${month} planting success.  Professional-grade tools and guidance included.`;
};

const generateSMSContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, type: 'workshop' | 'urgency') => {
  if (type === 'workshop') {
    return `${month} ${theme.label} Workshop - This weekend only. Learn seasonal techniques from our garden experts. Perfect timing for ${month} success. Reserve your spot now.`;
  }
  return `Final opportunity: ${month} ${theme.label} promotion ends this week. Don't miss premium plants and expert guidance for seasonal success. Visit soon.`;
};

const generateSocialContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, contentIdea?: string, platform?: string, timing?: string) => {
  const focus = contentIdea || seasonalFocus || theme.label;
  const timeContext = timing === 'friday' ? 'Feature Friday: ' : '';
  
  const socialContent = [
    `${timeContext}${month} brings perfect conditions for ${focus.toLowerCase()}.  Our experts recommend starting now for best results.`,
    `${timeContext}Timing matters for ${focus.toLowerCase()} success.  ${month} offers the ideal window for remarkable garden achievements.`,
    `${timeContext}Local gardeners are seeing amazing ${focus.toLowerCase()} results this ${month}.  Here's what makes the difference.`,
    `${timeContext}${month} is nature's signal for ${focus.toLowerCase()}.  Smart gardeners take advantage of these seasonal conditions.`
  ];
  
  const randomContent = socialContent[Math.floor(Math.random() * socialContent.length)];
  const engagement = platform === 'facebook' ? '  What gardening goals are you tackling this month?' : '';
  
  return `${randomContent}${engagement}  Stop by for expert guidance tailored to your garden's needs.`;
};

const generateInstagramContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, contentIdea?: string) => {
  const focus = contentIdea || seasonalFocus || theme.label;
  
  // Expert-level Instagram content without emojis or hashtags
  const expertContent = [
    `${month} is prime time for ${focus.toLowerCase()}.  Here's what successful gardeners are doing right now.`,
    `The secret to ${focus.toLowerCase()} success?  Timing is everything, and ${month} offers the perfect window.`,
    `Your ${focus.toLowerCase()} can thrive this ${month} with these proven techniques from our garden experts.`,
    `${month} weather creates ideal conditions for ${focus.toLowerCase()}.  Don't miss this seasonal opportunity.`
  ];
  
  const randomContent = expertContent[Math.floor(Math.random() * expertContent.length)];
  return `${randomContent}  Stop by for specific plant recommendations and expert timing advice for your garden's success.`;
};

const generateBehindScenesContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string) => {
  const expertInsights = [
    `Our growers are prepping the greenhouse for ${month} ${theme.label.toLowerCase()}.  Here's what we're selecting for peak performance this season.`,
    `Inside our propagation house: choosing the healthiest ${month} varieties.  Quality starts with careful selection and expert timing.`,
    `Early morning at the nursery: our team's selecting premium ${theme.label.toLowerCase()} plants.  We hand-pick every variety for ${month} success.`,
    `Behind the growing tables: why we choose these specific ${theme.label.toLowerCase()} varieties for ${month} conditions.`
  ];
  
  const randomInsight = expertInsights[Math.floor(Math.random() * expertInsights.length)];
  return `${randomInsight}  Visit us to see the difference expert selection makes for your garden.`;
};

const generateCustomerSpotlightContent = (theme: SeasonalPlanTheme, month: string) => {
  const successStories = [
    `Local gardener Sarah transformed her ${month} garden using our ${theme.label.toLowerCase()} recommendations.  Her results show what's possible with the right plant choices and timing.`,
    `This customer's ${theme.label.toLowerCase()} success proves that ${month} planting can exceed expectations.  Proper plant selection and expert advice make all the difference.`,
    `From struggling garden to ${month} showpiece: how our ${theme.label.toLowerCase()} guidance helped this customer achieve remarkable results.`,
    `Real results from a local garden: witness the transformation possible with expert ${theme.label.toLowerCase()} techniques and quality plants.`
  ];
  
  const randomStory = successStories[Math.floor(Math.random() * successStories.length)];
  return `${randomStory}  Ready to create your own success story this ${month}?  Our experts are here to help.`;
};

const generateTransformationContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string) => {
  const transformationIdeas = [
    `From bare soil to blooming garden: ${month} offers the perfect conditions for dramatic ${theme.label.toLowerCase()} transformations.  Proper plant selection and timing create stunning results.`,
    `Witness the power of seasonal planting: this ${month} makeover shows what expert ${theme.label.toLowerCase()} techniques can achieve in just weeks.`,
    `Dead space to garden paradise: ${month} is ideal for ${theme.label.toLowerCase()} projects that deliver immediate visual impact.`,
    `Before and after: how strategic ${month} planting transforms ordinary spaces into extraordinary gardens using proven ${theme.label.toLowerCase()} methods.`
  ];
  
  const randomTransformation = transformationIdeas[Math.floor(Math.random() * transformationIdeas.length)];
  return `${randomTransformation}  Let our garden experts help you plan your own remarkable transformation.`;
};

const generateWorkshopContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string) => {
  const workshopContent = [
    `This weekend: hands-on ${theme.label.toLowerCase()} workshop perfect for ${month} conditions.  Learn proven techniques that ensure your garden's success this season.`,
    `Saturday morning workshop: master ${theme.label.toLowerCase()} techniques with our garden experts.  Small class size means personalized attention for every skill level.`,
    `Join our ${month} ${theme.label.toLowerCase()} intensive: practical skills you'll use immediately in your garden.  Perfect timing for seasonal planting success.`,
    `Weekend workshop alert: expert-led ${theme.label.toLowerCase()} training designed for ${month} gardening success.  Bring your questions and leave with confidence.`
  ];
  
  const randomWorkshop = workshopContent[Math.floor(Math.random() * workshopContent.length)];
  return `${randomWorkshop}  Registration includes take-home materials and ongoing expert support.`;
};

const generateBlogContent = (theme: SeasonalPlanTheme, month: string, seasonalFocus: string, contentIdea?: string, holidays?: any[]) => {
  const focus = contentIdea || seasonalFocus || 'seasonal gardening';
  const holidayContext = holidays && holidays.length > 0 ? ` Plus, discover how to make the most of ${holidays[0].holiday_name} with your garden.` : '';
  
  return `Your complete guide to ${focus.toLowerCase()} in ${month}. From expert tips and timing to plant selection and care techniques - everything you need for success this season.${holidayContext} Includes step-by-step instructions, troubleshooting guide, and seasonal recipes.`;
};

// Fallback themes based on month when no templates are available
const getMonthBasedThemes = (monthDate: Date): SeasonalPlanTheme[] => {
  const month = monthDate.getMonth(); // 0-11
  
  if (month >= 2 && month <= 4) {
    // Spring themes (March-May)
    return [
      { id: 'spring-planting', label: 'Spring Planting Festival', description: 'Early season planting and garden preparation for spring growth' },
      { id: 'seed-starting', label: 'Seed Starting Workshop', description: 'Indoor seed starting and transplant preparation techniques' },
      { id: 'spring-cleanup', label: 'Spring Garden Renewal', description: 'Garden cleanup, pruning, and soil preparation for the growing season' },
      { id: 'pollinator-garden', label: 'Pollinator Garden Design', description: 'Creating bee and butterfly-friendly garden spaces' }
    ];
  } else if (month >= 5 && month <= 7) {
    // Summer themes (June-August) 
    return [
      { id: 'summer-care', label: 'Summer Garden Mastery', description: 'Heat protection, watering strategies, and summer plant care' },
      { id: 'harvest-preservation', label: 'Harvest & Preservation', description: 'Harvesting techniques and preserving summer abundance' },
      { id: 'container-gardening', label: 'Container Garden Magic', description: 'Maximizing small spaces with container gardening solutions' },
      { id: 'drought-resistant', label: 'Drought-Resistant Gardens', description: 'Water-wise gardening with drought-tolerant plants' }
    ];
  } else if (month >= 8 && month <= 10) {
    // Fall themes (September-November)
    return [
      { id: 'fall-planting', label: 'Fall Planting Success', description: 'Fall planting strategies and winter preparation' },
      { id: 'autumn-color', label: 'Autumn Color Spectacular', description: 'Designing for fall color with trees, shrubs, and perennials' },
      { id: 'bulb-planting', label: 'Spring Bulb Planning', description: 'Planting spring-flowering bulbs for next year\'s garden' },
      { id: 'harvest-festival', label: 'Harvest Festival Celebration', description: 'Celebrating the fall harvest with seasonal decorations' }
    ];
  } else {
    // Winter themes (December-February)
    return [
      { id: 'houseplant-care', label: 'Houseplant Winter Care', description: 'Indoor plant care and winter gardening techniques' },
      { id: 'holiday-gardening', label: 'Holiday Garden Magic', description: 'Holiday decorations, plants, and seasonal arrangements' },
      { id: 'winter-planning', label: 'Garden Planning Season', description: 'Planning and designing next year\'s garden layout and goals' },
      { id: 'indoor-growing', label: 'Indoor Growing Systems', description: 'Year-round growing with indoor gardening setups' }
    ];
  }
};

// Holiday-specific themes based on month
const getHolidayThemesForMonth = (monthNumber: number): SeasonalPlanTheme[] => {
  const holidayThemes: Record<number, SeasonalPlanTheme[]> = {
    1: [
      { id: 'new-year-planning', label: 'New Year Garden Goals', description: 'Setting garden resolutions and planning for the year ahead' }
    ],
    2: [
      { id: 'valentines-flowers', label: 'Valentine\'s Day Blooms', description: 'Romantic flowers and plants perfect for Valentine\'s Day gifts' }
    ],
    3: [
      { id: 'spring-equinox', label: 'Spring Equinox Celebration', description: 'Welcoming spring with seasonal planting and garden awakening' }
    ],
    4: [
      { id: 'easter-gardens', label: 'Easter Garden Revival', description: 'Spring gardens and Easter-themed planting ideas' },
      { id: 'earth-day', label: 'Earth Day Gardening', description: 'Sustainable gardening practices for Earth Day and beyond' }
    ],
    5: [
      { id: 'mothers-day-garden', label: 'Mother\'s Day Garden Gifts', description: 'Beautiful plants and garden gifts perfect for celebrating mothers' }
    ],
    6: [
      { id: 'fathers-day-garden', label: 'Father\'s Day Garden Projects', description: 'Garden tools, projects, and plants that dads will love' }
    ],
    7: [
      { id: 'july-fourth-garden', label: 'July 4th Patriotic Gardens', description: 'Red, white, and blue themed garden designs and celebrations' }
    ],
    8: [
      { id: 'late-summer-harvest', label: 'Late Summer Abundance', description: 'Maximizing late summer harvests and preserving techniques' }
    ],
    9: [
      { id: 'fall-equinox', label: 'Fall Equinox Transition', description: 'Transitioning gardens from summer to fall growing season' }
    ],
    10: [
      { id: 'halloween-gardens', label: 'Halloween Harvest Decor', description: 'Pumpkins, gourds, and spooky garden decorations' }
    ],
    11: [
      { id: 'thanksgiving-harvest', label: 'Thanksgiving Garden Gratitude', description: 'Celebrating the harvest season with gratitude and abundance' }
    ],
    12: [
      { id: 'holiday-plants', label: 'Holiday Plant Traditions', description: 'Poinsettias, Christmas trees, and festive holiday plant care' },
      { id: 'winter-solstice', label: 'Winter Solstice Gardens', description: 'Embracing the longest night with evergreen beauty and winter interest' }
    ]
  };
  
  return holidayThemes[monthNumber] || [];
};