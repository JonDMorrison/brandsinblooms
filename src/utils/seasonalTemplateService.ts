
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';

export interface SeasonalTemplate {
  id: string;
  name: string;
  category: 'seasonal' | 'holiday' | 'promotional' | 'educational' | 'community';
  season: 'spring' | 'summer' | 'fall' | 'winter' | 'year-round';
  theme: string;
  subject_templates: string[];
  content_blocks: Array<{
    type: 'header' | 'text' | 'image' | 'button' | 'divider';
    template: string;
    variables: string[];
    persona_adaptations?: Record<string, string>;
  }>;
  persona_tags: string[];
  garden_focus: string[];
  timing_recommendations: {
    best_days: string[];
    best_times: string[];
    avoid_dates: string[];
  };
  performance_metrics?: {
    avg_open_rate: number;
    avg_click_rate: number;
    usage_count: number;
  };
}

export const getSeasonalTemplateRecommendations = async (
  importedContent?: string,
  personaTags?: string[],
  currentDate: Date = new Date()
) => {
  try {
    const season = getCurrentSeason(currentDate);
    const weekNumber = getWeekNumber(currentDate);
    
    // Get relevant holidays for context
    const { data: upcomingHolidays } = await supabase
      .from('holidays')
      .select('*')
      .gte('holiday_date', currentDate.toISOString().split('T')[0])
      .lte('holiday_date', new Date(currentDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .eq('is_active', true);

    // Analyze imported content for theme matching
    let contentThemes: string[] = [];
    if (importedContent) {
      contentThemes = analyzeContentThemes(importedContent);
    }

    // Get base seasonal templates
    const seasonalTemplates = await getSeasonalTemplates(season, weekNumber);
    
    // Get persona-specific templates
    const personaTemplates = personaTags ? 
      await getPersonaTemplates(personaTags) : [];
    
    // Get holiday-specific templates
    const holidayTemplates = upcomingHolidays ? 
      await getHolidayTemplates(upcomingHolidays.map(h => h.id)) : [];

    // Score and rank templates
    const rankedTemplates = rankTemplatesByRelevance(
      [...seasonalTemplates, ...personaTemplates, ...holidayTemplates],
      {
        contentThemes,
        personaTags: personaTags || [],
        season,
        upcomingHolidays: upcomingHolidays || [],
        currentWeek: weekNumber
      }
    );

    return {
      recommended: rankedTemplates.slice(0, 6),
      seasonal: seasonalTemplates.slice(0, 8),
      persona_specific: personaTemplates.slice(0, 4),
      holiday_themed: holidayTemplates.slice(0, 4),
      content_analysis: {
        detected_themes: contentThemes,
        season_match: season,
        holiday_relevance: upcomingHolidays?.length > 0
      }
    };

  } catch (error) {
    console.error('Error getting template recommendations:', error);
    toast.error('Failed to load template recommendations');
    return {
      recommended: [],
      seasonal: [],
      persona_specific: [],
      holiday_themed: [],
      content_analysis: { detected_themes: [], season_match: 'spring', holiday_relevance: false }
    };
  }
};

const getSeasonalTemplates = async (season: string, weekNumber: number): Promise<SeasonalTemplate[]> => {
  // For now, return curated templates - in a real implementation, these would come from database
  const templates: SeasonalTemplate[] = [
    {
      id: 'spring-prep-1',
      name: 'Spring Garden Preparation',
      category: 'seasonal',
      season: 'spring',
      theme: 'Garden Preparation',
      subject_templates: [
        'Get Your Garden Spring-Ready! 🌱',
        'Spring Prep Essentials for {business_name} Customers',
        'Time to Wake Up Your Garden!'
      ],
      content_blocks: [
        {
          type: 'header',
          template: 'Spring is Here at {business_name}!',
          variables: ['business_name']
        },
        {
          type: 'text',
          template: 'As winter fades away, it\'s time to prepare your garden for the growing season ahead. Here are our top {season} recommendations for {location} gardeners:',
          variables: ['season', 'location'],
          persona_adaptations: {
            'beginner_gardener': 'New to gardening? Don\'t worry! Spring preparation is easier than you think.',
            'expert_gardener': 'Ready for another successful growing season? Here are some advanced tips:'
          }
        }
      ],
      persona_tags: ['beginner_gardener', 'seasonal_gardener', 'expert_gardener'],
      garden_focus: ['soil_preparation', 'seed_starting', 'tool_maintenance'],
      timing_recommendations: {
        best_days: ['Tuesday', 'Wednesday', 'Thursday'],
        best_times: ['09:00', '10:00'],
        avoid_dates: []
      }
    },
    {
      id: 'summer-care-1',
      name: 'Summer Garden Care',
      category: 'seasonal',
      season: 'summer',
      theme: 'Plant Care & Maintenance',
      subject_templates: [
        'Beat the Summer Heat - Garden Care Tips ☀️',
        'Keep Your Garden Thriving This Summer',
        'Summer Care Essentials from {business_name}'
      ],
      content_blocks: [
        {
          type: 'header',
          template: 'Summer Garden Success!',
          variables: []
        },
        {
          type: 'text',
          template: 'Summer brings both opportunities and challenges for gardeners. Here\'s how to keep your plants healthy and productive during the hottest months:',
          variables: [],
          persona_adaptations: {
            'vegetable_gardener': 'Summer is harvest time! Here\'s how to maximize your vegetable garden:',
            'flower_enthusiast': 'Keep your blooms beautiful all summer long with these care tips:'
          }
        }
      ],
      persona_tags: ['vegetable_gardener', 'flower_enthusiast', 'container_gardener'],
      garden_focus: ['watering', 'pest_control', 'heat_protection', 'harvesting'],
      timing_recommendations: {
        best_days: ['Monday', 'Tuesday', 'Wednesday'],
        best_times: ['08:00', '09:00'],
        avoid_dates: []
      }
    }
  ];

  return templates.filter(t => t.season === season || t.season === 'year-round');
};

const getPersonaTemplates = async (personaTags: string[]): Promise<SeasonalTemplate[]> => {
  // Get templates from the database that match persona tags
  try {
    const { data } = await supabase
      .from('crm_persona_campaign_templates')
      .select('*')
      .overlaps('tags', personaTags);

    // Convert database templates to our SeasonalTemplate format
    return (data || []).map(template => ({
      id: template.id,
      name: template.title,
      category: template.campaign_type as any || 'educational',
      season: template.season as any || 'year-round',
      theme: template.title,
      subject_templates: [`${template.title} - Expert Tips Inside`],
      content_blocks: [
        {
          type: 'text',
          template: template.description || '',
          variables: []
        }
      ],
      persona_tags: template.tags || [],
      garden_focus: [],
      timing_recommendations: {
        best_days: ['Tuesday', 'Wednesday', 'Thursday'],
        best_times: ['10:00'],
        avoid_dates: []
      }
    }));
  } catch (error) {
    console.error('Error fetching persona templates:', error);
    return [];
  }
};

const getHolidayTemplates = async (holidayIds: string[]): Promise<SeasonalTemplate[]> => {
  try {
    const { data: holidays } = await supabase
      .from('holidays')
      .select('*')
      .in('id', holidayIds);

    return (holidays || []).map(holiday => ({
      id: `holiday-${holiday.id}`,
      name: `${holiday.holiday_name} Garden Special`,
      category: 'holiday' as const,
      season: 'year-round' as const,
      theme: holiday.holiday_name,
      subject_templates: [
        `Celebrate ${holiday.holiday_name} with Your Garden! 🎉`,
        `${holiday.holiday_name} Gardening Ideas`,
        `Special ${holiday.holiday_name} Offers for Gardeners`
      ],
      content_blocks: [
        {
          type: 'header',
          template: `${holiday.holiday_name} Garden Celebration`,
          variables: []
        },
        {
          type: 'text',
          template: holiday.garden_relevance || `Make your garden part of your ${holiday.holiday_name} celebration!`,
          variables: []
        }
      ],
      persona_tags: [],
      garden_focus: [holiday.category],
      timing_recommendations: {
        best_days: ['Monday', 'Tuesday'],
        best_times: ['09:00', '10:00'],
        avoid_dates: [holiday.holiday_date]
      }
    }));
  } catch (error) {
    console.error('Error fetching holiday templates:', error);
    return [];
  }
};

const analyzeContentThemes = (content: string): string[] => {
  const themes: string[] = [];
  const lowerContent = content.toLowerCase();
  
  // Seasonal themes
  if (lowerContent.includes('spring') || lowerContent.includes('planting')) themes.push('spring_preparation');
  if (lowerContent.includes('summer') || lowerContent.includes('watering')) themes.push('summer_care');
  if (lowerContent.includes('fall') || lowerContent.includes('autumn')) themes.push('fall_maintenance');
  if (lowerContent.includes('winter') || lowerContent.includes('protection')) themes.push('winter_protection');
  
  // Garden types
  if (lowerContent.includes('vegetable') || lowerContent.includes('herb')) themes.push('vegetable_gardening');
  if (lowerContent.includes('flower') || lowerContent.includes('bloom')) themes.push('flower_gardening');
  if (lowerContent.includes('indoor') || lowerContent.includes('houseplant')) themes.push('indoor_gardening');
  
  // Activities
  if (lowerContent.includes('pest') || lowerContent.includes('disease')) themes.push('pest_control');
  if (lowerContent.includes('soil') || lowerContent.includes('fertiliz')) themes.push('soil_care');
  if (lowerContent.includes('prune') || lowerContent.includes('trim')) themes.push('plant_maintenance');
  
  return themes;
};

const rankTemplatesByRelevance = (
  templates: SeasonalTemplate[],
  context: {
    contentThemes: string[];
    personaTags: string[];
    season: string;
    upcomingHolidays: any[];
    currentWeek: number;
  }
): SeasonalTemplate[] => {
  return templates
    .map(template => ({
      ...template,
      relevanceScore: calculateRelevanceScore(template, context)
    }))
    .sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore);
};

const calculateRelevanceScore = (
  template: SeasonalTemplate,
  context: {
    contentThemes: string[];
    personaTags: string[];
    season: string;
    upcomingHolidays: any[];
    currentWeek: number;
  }
): number => {
  let score = 0;
  
  // Season match
  if (template.season === context.season) score += 30;
  if (template.season === 'year-round') score += 10;
  
  // Theme overlap
  const themeOverlap = template.garden_focus.filter(focus => 
    context.contentThemes.some(theme => theme.includes(focus))
  ).length;
  score += themeOverlap * 20;
  
  // Persona match
  const personaOverlap = template.persona_tags.filter(tag => 
    context.personaTags.includes(tag)
  ).length;
  score += personaOverlap * 15;
  
  // Holiday relevance
  if (template.category === 'holiday' && context.upcomingHolidays.length > 0) {
    score += 25;
  }
  
  // Performance boost for high-performing templates
  if (template.performance_metrics) {
    score += (template.performance_metrics.avg_open_rate - 0.2) * 50;
  }
  
  return score;
};

const getCurrentSeason = (date: Date): string => {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
};

const getWeekNumber = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
};

export const applyTemplateToContent = async (
  template: SeasonalTemplate,
  businessContext: any,
  personalizationData: any = {}
) => {
  try {
    const { data, error } = await supabase.functions.invoke('apply-template', {
      body: {
        template,
        business_context: businessContext,
        personalization_data: personalizationData,
        timestamp: new Date().toISOString()
      }
    });

    if (error) throw error;

    return data.applied_template;

  } catch (error) {
    console.error('Error applying template:', error);
    toast.error('Failed to apply template');
    throw error;
  }
};
