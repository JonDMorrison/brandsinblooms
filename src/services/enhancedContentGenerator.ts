import { supabase } from '@/integrations/supabase/client';
import { PlanItem, PlanTheme } from '@/components/plan/constants';
import { format } from 'date-fns';
import { fetchSmartImage } from './unsplashService';

interface ContentGenerationParams {
  themes: PlanTheme[];
  month: string;
  companyProfile?: any;
}

interface ChannelContent {
  type: 'email' | 'sms' | 'facebook' | 'instagram' | 'blog';
  title: string;
  caption: string;
  imageQuery: string;
  week: number;
  date: Date;
}

export const generateEnhancedPlanContent = async (
  params: ContentGenerationParams
): Promise<PlanItem[]> => {
  const { themes, month, companyProfile } = params;
  
  console.log('🎨 Generating enhanced plan content for themes:', themes.map(t => t.label));

  try {
    // Use fallback content generation for now (AI generation coming in next phase)
    console.log('Using fallback content generation');
    return generateFallbackContent(themes, month);
  } catch (error) {
    console.error('❌ Error in enhanced content generation:', error);
    return generateFallbackContent(themes, month);
  }
};

// Fallback content generation if AI fails
const generateFallbackContent = (themes: PlanTheme[], month: string): PlanItem[] => {
  const items: PlanItem[] = [];
  const monthDate = new Date(month + '-01');
  const monthName = format(monthDate, 'MMMM');

  themes.forEach((theme, themeIndex) => {
    const weekOffset = themeIndex;
    
    // Email
    items.push({
      id: `email-${theme.id}-${Date.now()}`,
      type: 'email',
      title: `${theme.label} Newsletter - ${monthName}`,
      caption: `Discover our ${theme.label.toLowerCase()} collection for ${monthName}. Expert tips and seasonal specials inside.`,
      date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1 + (weekOffset * 7)),
      enabled: true,
      week: weekOffset + 1,
      themeId: theme.id,
      themeName: theme.label,
      imageIdea: `${theme.label} ${monthName} garden`
    });

    // Social posts
    ['facebook', 'instagram'].forEach((platform, idx) => {
      items.push({
        id: `${platform}-${theme.id}-${Date.now()}-${idx}`,
        type: platform as any,
        title: `${theme.label} ${platform === 'instagram' ? 'Story' : 'Post'}`,
        caption: `${monthName} is perfect for ${theme.label.toLowerCase()}. Visit us for expert guidance.`,
        date: new Date(monthDate.getFullYear(), monthDate.getMonth(), 3 + (weekOffset * 7) + idx),
        enabled: true,
        week: weekOffset + 1,
        themeId: theme.id,
        themeName: theme.label,
        imageIdea: `${theme.label} ${platform} visual`
      });
    });
  });

  return items;
};
