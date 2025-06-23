import { supabase } from "@/integrations/supabase/client";
import { attachImagesToTask } from "@/services/contentGenerationHelpers";

export const generatePersonalizedContent = async (
  postType: string,
  campaignTitle: string,
  userId?: string,
  campaignDescription?: string
): Promise<string> => {
  console.log(`🔧 CONTENT_GEN DEBUG: Starting generation for ${postType.toUpperCase()}`);
  console.log(`🔧 CONTENT_GEN DEBUG: Campaign: "${campaignTitle}"`);
  console.log(`🔧 CONTENT_GEN DEBUG: User ID: ${userId}`);
  console.log(`🔧 CONTENT_GEN DEBUG: Description: "${campaignDescription}"`);

  if (postType === 'video') {
    console.log(`🎬 CONTENT_GEN DEBUG: Detected video type, calling generateVideoScript`);
    try {
      const result = await generateVideoScript(campaignTitle, userId, campaignDescription);
      console.log(`🎬 CONTENT_GEN DEBUG: Video script generated, length: ${result?.length || 0}`);
      console.log(`🎬 CONTENT_GEN DEBUG: Video script preview: ${result?.substring(0, 150)}...`);
      return result;
    } catch (error) {
      console.error(`🎬 CONTENT_GEN ERROR: Video script generation failed:`, error);
      throw error;
    }
  }

  if (postType === 'newsletter') {
    console.log(`📧 CONTENT_GEN DEBUG: Detected newsletter type, calling generateNewsletterContent`);
    return generateNewsletterContent('', campaignTitle, 0, userId, campaignDescription);
  }

  console.log(`📝 CONTENT_GEN DEBUG: Using standard content generation for ${postType}`);

  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType,
        campaignTitle,
        userId,
        campaignDescription
      }
    });

    if (error) {
      console.error(`📝 CONTENT_GEN ERROR: Supabase function error for ${postType}:`, error);
      throw new Error(`Content generation failed: ${error.message}`);
    }

    if (!data?.content) {
      console.error(`📝 CONTENT_GEN ERROR: No content returned for ${postType}`);
      throw new Error('No content generated');
    }

    console.log(`📝 CONTENT_GEN DEBUG: ${postType} content generated successfully, length: ${data.content.length}`);
    return data.content;
  } catch (error) {
    console.error(`📝 CONTENT_GEN ERROR: Exception in generatePersonalizedContent for ${postType}:`, error);
    throw error;
  }
};

export const generateVideoScript = async (
  campaignTitle: string,
  userId?: string,
  weekDescription?: string
): Promise<string> => {
  console.log(`🎬 VIDEO_SCRIPT DEBUG: Starting video script generation`);
  console.log(`🎬 VIDEO_SCRIPT DEBUG: Campaign: "${campaignTitle}"`);
  console.log(`🎬 VIDEO_SCRIPT DEBUG: User ID: ${userId}`);
  console.log(`🎬 VIDEO_SCRIPT DEBUG: Week description: "${weekDescription}"`);

  try {
    const { data, error } = await supabase.functions.invoke('generate-video-script', {
      body: {
        campaignTitle,
        userId,
        weekDescription
      }
    });

    if (error) {
      console.error(`🎬 VIDEO_SCRIPT ERROR: Supabase function invoke error:`, error);
      throw new Error(`Video script generation failed: ${error.message}`);
    }

    if (!data?.script) {
      console.error(`🎬 VIDEO_SCRIPT ERROR: No script returned from function`);
      console.error(`🎬 VIDEO_SCRIPT ERROR: Function response data:`, data);
      throw new Error('No video script generated');
    }

    console.log(`🎬 VIDEO_SCRIPT DEBUG: Script generated successfully`);
    console.log(`🎬 VIDEO_SCRIPT DEBUG: Script length: ${data.script.length}`);
    console.log(`🎬 VIDEO_SCRIPT DEBUG: Script preview: ${data.script.substring(0, 200)}...`);

    return data.script;
  } catch (error) {
    console.error(`🎬 VIDEO_SCRIPT ERROR: Exception in generateVideoScript:`, error);
    console.error(`🎬 VIDEO_SCRIPT ERROR: Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
};

// Newsletter generation function
export const generateNewsletterContent = async (
  newsletterType: string,
  campaignTitle: string,
  weekNumber: number,
  userId?: string,
  description?: string
): Promise<string> => {
  console.log(`📧 NEWSLETTER DEBUG: Generating newsletter content`);
  console.log(`📧 NEWSLETTER DEBUG: Campaign: "${campaignTitle}"`);
  console.log(`📧 NEWSLETTER DEBUG: Week: ${weekNumber}`);
  console.log(`📧 NEWSLETTER DEBUG: User ID: ${userId}`);

  try {
    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        newsletterType,
        campaignTitle,
        weekNumber,
        userId,
        description
      }
    });

    if (error) {
      console.error(`📧 NEWSLETTER ERROR: Generation failed:`, error);
      throw new Error(`Newsletter generation failed: ${error.message}`);
    }

    if (!data?.content) {
      console.error(`📧 NEWSLETTER ERROR: No content returned`);
      throw new Error('No newsletter content generated');
    }

    console.log(`📧 NEWSLETTER DEBUG: Newsletter generated successfully, length: ${data.content.length}`);
    return data.content;
  } catch (error) {
    console.error(`📧 NEWSLETTER ERROR: Exception in generateNewsletterContent:`, error);
    throw error;
  }
};

// Campaign content generation function with image attachment
export const generateCampaignContent = async (
  campaignId: string,
  campaignTitle: string,
  description: string,
  userId: string,
  weekNumber?: number,
  tenantId?: string
): Promise<{ success: boolean; message?: string; tasks?: any[] }> => {
  console.log(`🚀 CAMPAIGN_GEN DEBUG: Starting campaign content generation`);
  console.log(`🚀 CAMPAIGN_GEN DEBUG: Campaign ID: ${campaignId}`);
  console.log(`🚀 CAMPAIGN_GEN DEBUG: Title: "${campaignTitle}"`);
  console.log(`🚀 CAMPAIGN_GEN DEBUG: User ID: ${userId}`);
  console.log(`🚀 CAMPAIGN_GEN DEBUG: Tenant ID: ${tenantId}`);

  try {
    const { data, error } = await supabase.functions.invoke('generate_campaign_content', {
      body: {
        campaign_id: campaignId,
        campaign_title: campaignTitle,
        description,
        user_id: userId,
        week_number: weekNumber,
        tenant_id: tenantId
      }
    });

    if (error) {
      console.error(`🚀 CAMPAIGN_GEN ERROR: Generation failed:`, error);
      return { success: false, message: error.message };
    }

    // Attach images to generated tasks
    if (data?.tasks && Array.isArray(data.tasks)) {
      console.log(`🖼️ CAMPAIGN_GEN DEBUG: Attaching images to ${data.tasks.length} tasks`);
      
      for (const task of data.tasks) {
        try {
          await attachImagesToTask(task);
        } catch (imageError) {
          console.warn(`🖼️ CAMPAIGN_GEN WARN: Failed to attach image to task ${task.id}:`, imageError);
          // Continue without failing the entire process
        }
      }
    }

    console.log(`🚀 CAMPAIGN_GEN DEBUG: Campaign content generated successfully`);
    return { success: true, tasks: data?.tasks || [] };
  } catch (error) {
    console.error(`🚀 CAMPAIGN_GEN ERROR: Exception in generateCampaignContent:`, error);
    return { success: false, message: error.message };
  }
};
