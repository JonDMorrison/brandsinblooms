
import { supabase } from "@/integrations/supabase/client";

export const generatePersonalizedContent = async (postType: string, campaignTitle: string, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating validated ${postType} content for: ${campaignTitle} with description: ${weekDescription}`);
  
  try {
    // Spend token before generation
    if (userId) {
      const { data: tokenSpent, error: tokenError } = await supabase.rpc('spend_tokens', {
        p_user_id: userId,
        p_tokens: 1,
        p_action_type: 'generation',
        p_content_type: postType
      });

      if (tokenError) {
        console.error('❌ Error spending token:', tokenError);
        throw new Error('Failed to process token for content generation');
      }

      console.log('✅ Token spent for content generation');
    }

    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType: postType,
        campaignTheme: campaignTitle,
        campaignTitle: campaignTitle,
        weekDescription: weekDescription,
        userId: userId,
        enforceCompanyName: true
      }
    });

    if (error) {
      console.error('❌ Error generating personalized, region-aware content:', error);
      throw error;
    }

    if (data.generationAttempts && data.generationAttempts > 1) {
      console.log(`✅ Content generated after ${data.generationAttempts} attempts with validation`);
    }
    
    if (data.validationPassed === false) {
      console.warn('⚠️ Content generated but validation concerns remain');
    }

    console.log(`✅ Generated ${postType} content successfully:`, data.content?.substring(0, 100) + '...');
    return data.content || data.generatedText || `Generated ${postType} content for ${campaignTitle}`;
  } catch (error) {
    console.error('❌ Error in generatePersonalizedContent:', error);
    throw error;
  }
};

export const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating region-aware newsletter content for campaign: ${campaignTitle} (Week ${weekNumber}) with description: ${weekDescription}`);
  
  try {
    // Spend token before generation
    if (userId) {
      const { data: tokenSpent, error: tokenError } = await supabase.rpc('spend_tokens', {
        p_user_id: userId,
        p_tokens: 2, // Newsletter costs 2 tokens as it's more complex
        p_action_type: 'generation',
        p_content_type: 'newsletter',
        p_campaign_id: campaignId
      });

      if (tokenError) {
        console.error('❌ Error spending token:', tokenError);
        throw new Error('Failed to process token for newsletter generation');
      }

      console.log('✅ Tokens spent for newsletter generation');
    }

    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        campaignId: campaignId,
        campaignTitle: campaignTitle,
        weekNumber: weekNumber,
        weekDescription: weekDescription,
        userId: userId,
        enforceCompanyName: true
      }
    });

    if (error) {
      console.error('❌ Error generating newsletter content:', error);
      throw error;
    }

    console.log(`✅ Generated newsletter content successfully:`, data.content?.substring(0, 100) + '...');
    return data.content || data.generatedText || `Generated newsletter content for ${campaignTitle}`;
  } catch (error) {
    console.error('❌ Error in generateNewsletterContent:', error);
    throw error;
  }
};

export const generateVideoScript = async (campaignTitle: string, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating region-aware video script for: ${campaignTitle} with description: ${weekDescription}`);
  
  try {
    // Spend token before generation
    if (userId) {
      const { data: tokenSpent, error: tokenError } = await supabase.rpc('spend_tokens', {
        p_user_id: userId,
        p_tokens: 2, // Video script costs 2 tokens as it's more complex
        p_action_type: 'generation',
        p_content_type: 'video'
      });

      if (tokenError) {
        console.error('❌ Error spending token:', tokenError);
        throw new Error('Failed to process token for video script generation');
      }

      console.log('✅ Tokens spent for video script generation');
    }

    const { data, error } = await supabase.functions.invoke('generate-video-script', {
      body: {
        campaignTitle: campaignTitle,
        weekDescription: weekDescription,
        userId: userId,
        enforceCompanyName: true
      }
    });

    if (error) {
      console.error('❌ Error generating video script:', error);
      throw error;
    }

    console.log(`✅ Generated video script successfully:`, data.script?.substring(0, 100) + '...');
    return data.script || data.generatedText || `Generated video script for ${campaignTitle}`;
  } catch (error) {
    console.error('❌ Error in generateVideoScript:', error);
    throw error;
  }
};
