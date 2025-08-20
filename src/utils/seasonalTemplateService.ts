
import { supabase } from '@/integrations/supabase/client';
import { getCurrentWeekNumber } from '@/utils/dateUtils';

export interface SeasonalTemplate {
  id: string;
  title: string;
  theme: string;
  week_number: number;
  seasonal_focus: string;
  content_ideas: string;
}

export const getSeasonalTemplates = async (weekNumber?: number): Promise<SeasonalTemplate[]> => {
  try {
    let query = supabase
      .from('master_campaign_templates')
      .select('*')
      .order('week_number');

    if (weekNumber) {
      query = query.eq('week_number', weekNumber);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching seasonal templates:', error);
    return [];
  }
};

export const recommendTemplatesForContent = async (content: string): Promise<SeasonalTemplate[]> => {
  try {
    // Simple keyword matching for now - could be enhanced with AI later
    const keywords = content.toLowerCase().split(' ');
    
    const { data, error } = await supabase
      .from('master_campaign_templates')
      .select('*')
      .order('week_number');

    if (error) throw error;

    // Filter templates based on content keywords
    const recommendations = (data || []).filter(template => {
      const templateText = `${template.title} ${template.theme} ${template.seasonal_focus} ${template.content_ideas}`.toLowerCase();
      return keywords.some(keyword => templateText.includes(keyword));
    });

    return recommendations.slice(0, 3); // Return top 3 recommendations
  } catch (error) {
    console.error('Error getting template recommendations:', error);
    return [];
  }
};

export const getCurrentSeasonalTemplate = async (): Promise<SeasonalTemplate | null> => {
  try {
    const currentWeek = getCurrentWeekNumber();
    
    const { data, error } = await supabase
      .from('master_campaign_templates')
      .select('*')
      .eq('week_number', currentWeek)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching current seasonal template:', error);
    return null;
  }
};
