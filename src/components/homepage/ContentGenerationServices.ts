
import { supabase } from "@/integrations/supabase/client";
import { attachImagesToTask } from "@/services/contentGenerationHelpers";
import { transformCampaignTitle, cleanContentFromWeekReferences } from "@/utils/campaignTitleUtils";

export const generatePersonalizedContent = async (
  postType: string,
  campaignTitle: string,
  userId?: string,
  campaignDescription?: string
): Promise<string> => {
  console.log(`🔧 CONTENT_GEN DEBUG: Starting generation for ${postType.toUpperCase()}`);
  
  // Transform campaign title to remove week references
  const cleanTitle = transformCampaignTitle(campaignTitle);
  console.log(`🔧 CONTENT_GEN DEBUG: Transformed title from "${campaignTitle}" to "${cleanTitle}"`);

  if (postType === 'video') {
    console.log(`🎬 CONTENT_GEN DEBUG: Detected video type, calling generateVideoScript`);
    try {
      const result = await generateVideoScript(cleanTitle, userId, campaignDescription);
      const cleanedResult = cleanContentFromWeekReferences(result);
      console.log(`🎬 CONTENT_GEN DEBUG: Video script generated and cleaned, length: ${cleanedResult?.length || 0}`);
      return cleanedResult;
    } catch (error) {
      console.error(`🎬 CONTENT_GEN ERROR: Video script generation failed:`, error);
      throw error;
    }
  }

  if (postType === 'newsletter') {
    console.log(`📧 CONTENT_GEN DEBUG: Detected newsletter type, calling generateNewsletterContent`);
    const result = await generateNewsletterContent('', cleanTitle, 0, userId, campaignDescription);
    return cleanContentFromWeekReferences(result);
  }

  console.log(`📝 CONTENT_GEN DEBUG: Using standard content generation for ${postType}`);

  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType,
        campaignTitle: cleanTitle,
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

    const cleanedContent = cleanContentFromWeekReferences(data.content);
    console.log(`📝 CONTENT_GEN DEBUG: ${postType} content generated and cleaned successfully, length: ${cleanedContent.length}`);
    return cleanedContent;
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
  
  // Transform title to remove week references
  const cleanTitle = transformCampaignTitle(campaignTitle);
  console.log(`🎬 VIDEO_SCRIPT DEBUG: Using cleaned title: "${cleanTitle}"`);

  try {
    const { data, error } = await supabase.functions.invoke('generate-video-script', {
      body: {
        campaignTitle: cleanTitle,
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
      throw new Error('No video script generated');
    }

    const cleanedScript = cleanContentFromWeekReferences(data.script);
    console.log(`🎬 VIDEO_SCRIPT DEBUG: Script generated and cleaned successfully`);
    return cleanedScript;
  } catch (error) {
    console.error(`🎬 VIDEO_SCRIPT ERROR: Exception in generateVideoScript:`, error);
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
  
  // Transform title to remove week references
  const cleanTitle = transformCampaignTitle(campaignTitle);
  console.log(`📧 NEWSLETTER DEBUG: Using cleaned title: "${cleanTitle}"`);

  try {
    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        newsletterType,
        campaignTitle: cleanTitle,
        weekNumber: 0, // Always use 0 to avoid week number references
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

    const cleanedContent = cleanContentFromWeekReferences(data.content);
    console.log(`📧 NEWSLETTER DEBUG: Newsletter generated and cleaned successfully, length: ${cleanedContent.length}`);
    return cleanedContent;
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
  
  // Transform title to remove week references
  const cleanTitle = transformCampaignTitle(campaignTitle);
  console.log(`🚀 CAMPAIGN_GEN DEBUG: Using cleaned title: "${cleanTitle}"`);

  try {
    const { data, error } = await supabase.functions.invoke('generate_campaign_content', {
      body: {
        campaign_id: campaignId,
        campaign_title: cleanTitle,
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

    // Attach images to generated tasks and clean content
    if (data?.tasks && Array.isArray(data.tasks)) {
      console.log(`🖼️ CAMPAIGN_GEN DEBUG: Processing ${data.tasks.length} tasks`);
      
      for (const task of data.tasks) {
        try {
          // Clean any week references from generated content
          if (task.ai_output) {
            task.ai_output = cleanContentFromWeekReferences(task.ai_output);
          }
          
          await attachImagesToTask(task);
        } catch (imageError) {
          console.warn(`🖼️ CAMPAIGN_GEN WARN: Failed to process task ${task.id}:`, imageError);
        }
      }
    }

    console.log(`🚀 CAMPAIGN_GEN DEBUG: Campaign content generated and cleaned successfully`);
    return { success: true, tasks: data?.tasks || [] };
  } catch (error) {
    console.error(`🚀 CAMPAIGN_GEN ERROR: Exception in generateCampaignContent:`, error);
    return { success: false, message: error.message };
  }
};
