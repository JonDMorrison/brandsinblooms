
import { supabase } from "@/integrations/supabase/client";
import { transformCampaignTitle, cleanContentFromWeekReferences } from "@/utils/campaignTitleUtils";

export interface PromoItem {
  name: string;
  sale_text: string;
  link: string;
}

export const generateStructuredNewsletter = async (
  campaignId: string,
  campaignTitle: string,
  weekNumber: number,
  userId?: string,
  weekDescription?: string,
  promoItems: PromoItem[] = [],
  toneNote?: string
) => {
  console.log(`🎯 Generating 4-section structured newsletter for campaign: ${campaignTitle}`);
  
  // Transform title to remove week references
  const cleanTitle = transformCampaignTitle(campaignTitle);
  console.log(`🎯 Using cleaned title: "${cleanTitle}"`);
  
  try {
    console.log('📡 Calling generate-structured-newsletter function for 4-section format');

    // Determine if this is a holiday or seasonal theme
    const isHoliday = weekNumber === 0;
    const focusDescription = isHoliday 
      ? weekDescription || `Special ${cleanTitle} content for garden centers`
      : weekDescription || `Seasonal focus on ${cleanTitle}`;

    const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
      body: {
        business_name: '', // Will be filled from company profile
        theme: cleanTitle,
        week_focus: focusDescription,
        promo_items: promoItems,
        tone_note: toneNote || '',
        userId: userId,
        is_holiday: isHoliday,
        holiday_context: isHoliday ? cleanTitle : undefined
      }
    });

    console.log('📨 Response from generate-structured-newsletter function:', { data, error });

    if (error) {
      console.error('❌ Error generating 4-section structured newsletter:', error);
      throw new Error(`Structured newsletter generation failed: ${error.message || 'Unknown error'}`);
    }

    const content = data?.yamlContent;
    if (!content) {
      throw new Error('No structured newsletter content returned');
    }

    // Clean any remaining week references from the content
    const cleanedContent = cleanContentFromWeekReferences(content);

    // Validate newsletter content quality
    const isValidNewsletter = cleanedContent.includes('newsletter_md: |') && 
                             (cleanedContent.match(/## /g) || []).length >= 3 &&
                             cleanedContent.length > 250;

    if (!isValidNewsletter) {
      console.warn(`⚠️ Generated newsletter failed validation - missing structure or too short. Length: ${cleanedContent.length}`);
      throw new Error('Generated newsletter content is invalid or incomplete');
    }

    // Validate that the content has the expected 4-section structure
    const blockMatches = cleanedContent.match(/- title:/g);
    const blockCount = blockMatches ? blockMatches.length : 0;
    
    if (blockCount !== 4) {
      console.warn(`⚠️ Generated newsletter has ${blockCount} sections instead of 4. Content may need regeneration.`);
    } else {
      console.log(`✅ Generated 4-section structured newsletter successfully`);
    }

    return cleanedContent;
  } catch (error) {
    console.error('❌ Error in generateStructuredNewsletter:', error);
    throw error;
  }
};
