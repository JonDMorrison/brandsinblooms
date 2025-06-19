
import { supabase } from "@/integrations/supabase/client";

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
  console.log(`🎯 Generating structured newsletter for campaign: ${campaignTitle} (Week ${weekNumber})`);
  
  try {
    console.log('📡 Calling generate-structured-newsletter function');

    const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
      body: {
        business_name: '', // Will be filled from company profile
        theme: campaignTitle,
        week_focus: weekDescription || `Week ${weekNumber} focus`,
        promo_items: promoItems,
        tone_note: toneNote || '',
        userId: userId
      }
    });

    console.log('📨 Response from generate-structured-newsletter function:', { data, error });

    if (error) {
      console.error('❌ Error generating structured newsletter:', error);
      throw new Error(`Structured newsletter generation failed: ${error.message || 'Unknown error'}`);
    }

    const content = data?.content;
    if (!content) {
      throw new Error('No structured newsletter content returned');
    }

    console.log(`✅ Generated structured newsletter successfully`);
    return content;
  } catch (error) {
    console.error('❌ Error in generateStructuredNewsletter:', error);
    throw error;
  }
};
