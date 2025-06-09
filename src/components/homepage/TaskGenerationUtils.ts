
import { supabase } from "@/integrations/supabase/client";
import { getCurrentWeekNumber } from "./homepageUtils";

export const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number, userId?: string) => {
  try {
    console.log('Generating newsletter for campaign:', campaignTitle);
    
    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        campaignId,
        campaignTitle,
        weekNumber,
        userId
      }
    });

    if (error) {
      console.error('Error generating newsletter:', error);
      throw new Error('Failed to generate newsletter with OpenAI');
    }

    // Extract clean content from the response
    if (data?.content) {
      if (typeof data.content === 'object' && data.content.content) {
        return data.content.content;
      }
      if (typeof data.content === 'string') {
        return data.content;
      }
    }

    throw new Error('No content returned from OpenAI');
  } catch (error) {
    console.error('Error generating newsletter:', error);
    throw error;
  }
};

export const generatePersonalizedContent = async (postType: string, campaignTitle: string, userId?: string) => {
  try {
    console.log('Generating personalized content with OpenAI for:', postType);
    
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType,
        campaignTitle,
        userId
      }
    });

    if (error) {
      console.error('Error generating content:', error);
      throw new Error(`Failed to generate ${postType} content with OpenAI`);
    }

    if (data?.content) {
      return data.content;
    }

    throw new Error('No content returned from OpenAI');
  } catch (error) {
    console.error('Error generating personalized content:', error);
    throw error;
  }
};

export const generateVideoScript = async (campaignTitle: string, userId?: string) => {
  try {
    console.log('Generating video script with OpenAI');
    
    const { data, error } = await supabase.functions.invoke('generate-video-script', {
      body: {
        campaignTitle,
        userId
      }
    });

    if (error) {
      console.error('Error generating video script:', error);
      throw new Error('Failed to generate video script with OpenAI');
    }

    if (data?.script) {
      return data.script;
    }

    throw new Error('No script returned from OpenAI');
  } catch (error) {
    console.error('Error generating video script:', error);
    throw error;
  }
};

export const getHashtagsForType = (postType: string) => {
  switch (postType) {
    case 'newsletter':
      return '#Newsletter #GardenTips #Community';
    case 'instagram':
      return '#GardenLife #Plants #Instagram #GreenThumb';
    case 'facebook':
      return '#GardenCenter #Community #Facebook #Gardening';
    case 'email':
      return '#Newsletter #EmailMarketing #GardenTips';
    case 'video':
      return '#GardenVideo #Tutorial #HowTo #Gardening';
    default:
      return `#${postType} #Campaign #Gardening`;
  }
};

export const getImageIdeaForType = (postType: string) => {
  switch (postType) {
    case 'newsletter':
      return 'Newsletter header with seasonal garden imagery';
    case 'instagram':
      return 'Square format photo of featured plants or garden scene';
    case 'facebook':
      return 'Landscape photo showcasing garden center or seasonal plants';
    case 'email':
      return 'Email header with garden center branding and seasonal elements';
    case 'video':
      return 'Video thumbnail with gardening tools and plants';
    default:
      return `${postType} post image idea`;
  }
};
