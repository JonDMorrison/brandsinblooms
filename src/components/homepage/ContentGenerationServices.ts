
import { supabase } from "@/integrations/supabase/client";

export const generatePersonalizedContent = async (postType: string, campaignTitle: string, userId?: string, weekDescription?: string) => {
  console.log(`Generating validated ${postType} content for: ${campaignTitle} with description: ${weekDescription}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType: postType,
        campaignTheme: campaignTitle,
        campaignTitle: campaignTitle,
        weekDescription: weekDescription,
        userId: userId
      }
    });

    if (error) {
      console.error('Error generating personalized, region-aware content:', error);
      throw error;
    }

    // Log validation results if available
    if (data.generationAttempts && data.generationAttempts > 1) {
      console.log(`Content generated after ${data.generationAttempts} attempts with validation`);
    }
    
    if (data.validationPassed === false) {
      console.warn('Content generated but validation concerns remain');
    }

    return data.content || data.generatedText || `Generated ${postType} content for ${campaignTitle}`;
  } catch (error) {
    console.error('Error in generatePersonalizedContent:', error);
    throw error;
  }
};

export const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number, userId?: string, weekDescription?: string) => {
  console.log(`Generating region-aware newsletter content for campaign: ${campaignTitle} (Week ${weekNumber}) with description: ${weekDescription}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        campaignId: campaignId,
        campaignTitle: campaignTitle,
        weekNumber: weekNumber,
        weekDescription: weekDescription,
        userId: userId
      }
    });

    if (error) {
      console.error('Error generating newsletter content:', error);
      throw error;
    }

    return data.content || data.generatedText || `Generated newsletter content for ${campaignTitle}`;
  } catch (error) {
    console.error('Error in generateNewsletterContent:', error);
    throw error;
  }
};

export const generateVideoScript = async (campaignTitle: string, userId?: string, weekDescription?: string) => {
  console.log(`Generating region-aware video script for: ${campaignTitle} with description: ${weekDescription}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-video-script', {
      body: {
        campaignTitle: campaignTitle,
        weekDescription: weekDescription,
        userId: userId
      }
    });

    if (error) {
      console.error('Error generating video script:', error);
      throw error;
    }

    return data.script || data.generatedText || `Generated video script for ${campaignTitle}`;
  } catch (error) {
    console.error('Error in generateVideoScript:', error);
    throw error;
  }
};
