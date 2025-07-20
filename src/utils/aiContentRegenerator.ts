
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';

export interface RegenerationOptions {
  tone?: 'professional' | 'friendly' | 'urgent' | 'casual' | 'enthusiastic';
  focus?: 'seasonal' | 'promotional' | 'educational' | 'community' | 'product_highlight';
  personaTag?: string;
  seasonalContext?: string;
  targetAudience?: string;
  contentType?: 'subject_line' | 'email_body' | 'call_to_action' | 'full_campaign';
  preserveStructure?: boolean;
}

export interface ContentBlock {
  id?: string;
  type: 'header' | 'text' | 'image' | 'button' | 'divider';
  title?: string;
  content?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  canRegenerate?: boolean;
}

export const regenerateEmailContent = async (
  originalContent: string,
  options: RegenerationOptions = {}
) => {
  try {
    // Get user's company profile for business context
    const { data: profile } = await supabase
      .from('company_profiles')
      .select('company_name, brand_voice, target_audience, specializations, seasonal_focus')
      .single();

    // Get current seasonal context
    const currentDate = new Date();
    const seasonalContext = await getCurrentSeasonalContext(currentDate);

    const { data, error } = await supabase.functions.invoke('regenerate-email-content', {
      body: {
        original_content: originalContent,
        business_context: {
          company_name: profile?.company_name || 'Your Garden Center',
          brand_voice: profile?.brand_voice || 'friendly and helpful',
          target_audience: profile?.target_audience || 'garden enthusiasts',
          specializations: profile?.specializations || 'general gardening',
          seasonal_focus: profile?.seasonal_focus || 'year-round gardening'
        },
        regeneration_options: {
          tone: options.tone || 'friendly',
          focus: options.focus || 'seasonal',
          persona_tag: options.personaTag,
          target_audience: options.targetAudience || profile?.target_audience,
          content_type: options.contentType || 'full_campaign',
          preserve_structure: options.preserveStructure || false
        },
        seasonal_context: seasonalContext,
        timestamp: new Date().toISOString()
      }
    });

    if (error) throw error;

    return data.regenerated_content;

  } catch (error) {
    console.error('Error regenerating email content:', error);
    toast.error('Failed to regenerate content');
    throw error;
  }
};

export const regenerateContentBlock = async (
  block: ContentBlock,
  options: RegenerationOptions = {}
) => {
  try {
    const { data, error } = await supabase.functions.invoke('regenerate-content-block', {
      body: {
        block_data: {
          type: block.type,
          title: block.title,
          content: block.content,
          cta_text: block.ctaText
        },
        regeneration_options: options,
        timestamp: new Date().toISOString()
      }
    });

    if (error) throw error;

    return {
      type: data.regenerated_block.type,
      title: data.regenerated_block.title,
      content: data.regenerated_block.content,
      ctaText: data.regenerated_block.cta_text,
      ctaUrl: block.ctaUrl,
      imageUrl: block.imageUrl
    };

  } catch (error) {
    console.error('Error regenerating content block:', error);
    toast.error('Failed to regenerate content block');
    throw error;
  }
};

const getCurrentSeasonalContext = async (date: Date) => {
  try {
    // Get current week number for seasonal context
    const weekNumber = getWeekNumber(date);
    
    // Fetch relevant seasonal context from holidays and templates
    const { data: holidays } = await supabase
      .from('holidays')
      .select('*')
      .gte('holiday_date', new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('holiday_date', new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .eq('is_active', true);

    const { data: templates } = await supabase
      .from('master_campaign_templates')
      .select('*')
      .eq('week_number', weekNumber)
      .limit(1)
      .single();

    return {
      current_season: getSeason(date),
      week_number: weekNumber,
      upcoming_holidays: holidays || [],
      seasonal_theme: templates?.theme,
      seasonal_focus: templates?.seasonal_focus,
      garden_tasks: getSeasonalGardenTasks(date)
    };

  } catch (error) {
    console.error('Error getting seasonal context:', error);
    return {
      current_season: getSeason(date),
      week_number: getWeekNumber(date),
      upcoming_holidays: [],
      garden_tasks: []
    };
  }
};

const getWeekNumber = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
};

const getSeason = (date: Date): string => {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
};

const getSeasonalGardenTasks = (date: Date): string[] => {
  const season = getSeason(date);
  const month = date.getMonth() + 1;
  
  const seasonalTasks = {
    spring: ['soil preparation', 'seed starting', 'pruning', 'fertilizing'],
    summer: ['watering', 'pest control', 'harvesting', 'deadheading'],
    fall: ['planting bulbs', 'leaf cleanup', 'winterizing', 'composting'],
    winter: ['planning', 'tool maintenance', 'indoor gardening', 'order catalogs']
  };
  
  return seasonalTasks[season] || [];
};
