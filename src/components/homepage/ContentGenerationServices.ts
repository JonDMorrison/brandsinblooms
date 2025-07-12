
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TASK_STATUS, type TaskStatus } from "@/constants/taskStatus";

export interface ContentGenerationResult {
  success: boolean;
  message: string;
  tasks?: any[];
}

// Add interface for Supabase function response
interface SupabaseFunctionResponse {
  data?: {
    content?: string;
  };
  error?: {
    message: string;
  };
}

// Legacy function exports for backward compatibility
export const generatePersonalizedContent = async (
  postType: string,
  campaignTitle: string,
  userId?: string | null,
  weekDescription?: string
): Promise<string> => {
  console.log('🎯 Legacy generatePersonalizedContent called:', { postType, campaignTitle });
  
  try {
    const { data: contentResult, error: contentError } = await supabase.functions.invoke('generate-content', {
      body: {
        postType: postType,
        campaignTitle: campaignTitle,
        userId: userId,
        weekDescription: weekDescription,
        enforceCompanyName: true
      }
    });

    if (contentError) {
      console.error('❌ Error generating content:', contentError);
      throw new Error(contentError.message);
    }

    if (!contentResult?.content) {
      throw new Error('No content generated');
    }

    return contentResult.content;
  } catch (error) {
    console.error('❌ generatePersonalizedContent failed:', error);
    throw error;
  }
};

export const generateNewsletterContent = async (
  campaignId: string,
  campaignTitle: string,
  weekNumber: number,
  userId: string,
  weekDescription?: string
): Promise<string> => {
  console.log('🎯 Legacy generateNewsletterContent called:', { campaignId, campaignTitle });
  
  try {
    const { data: result, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        campaignId: campaignId,
        userId: userId
      }
    });

    if (error) {
      console.error('❌ Newsletter generation error:', error);
      throw new Error(error.message);
    }

    if (!result?.content) {
      throw new Error('No newsletter content generated');
    }

    return result.content;
  } catch (error) {
    console.error('❌ generateNewsletterContent failed:', error);
    throw error;
  }
};

export const generateVideoScript = async (
  campaignTitle: string,
  userId?: string | null,
  weekDescription?: string
): Promise<string> => {
  console.log('🎯 Legacy generateVideoScript called:', { campaignTitle });
  
  try {
    const { data: contentResult, error: contentError } = await supabase.functions.invoke('generate-content', {
      body: {
        postType: 'video',
        campaignTitle: campaignTitle,
        userId: userId,
        weekDescription: weekDescription,
        enforceCompanyName: true
      }
    });

    if (contentError) {
      console.error('❌ Error generating video script:', contentError);
      throw new Error(contentError.message);
    }

    if (!contentResult?.content) {
      throw new Error('No video script generated');
    }

    return contentResult.content;
  } catch (error) {
    console.error('❌ generateVideoScript failed:', error);
    throw error;
  }
};

export const generateCampaignContent = async (
  campaignId: string,
  campaignTheme: string,
  campaignDescription: string,
  userId: string,
  weekNumber?: number,
  tenantId?: string
): Promise<ContentGenerationResult> => {
  console.log('🚀 OPTIMIZED: Starting parallel campaign content generation:', {
    campaignId,
    campaignTheme,
    userId,
    weekNumber,
    tenantId
  });

  try {
    // Validate required parameters
    if (!campaignId || !userId) {
      throw new Error('Campaign ID and User ID are required');
    }

    // Check if content already exists
    const { data: existingTasks, error: checkError } = await supabase
      .from('content_tasks')
      .select('id, post_type, status')
      .eq('campaign_id', campaignId)
      .not('status', 'eq', 'cancelled');

    if (checkError) {
      console.error('❌ Error checking existing tasks:', checkError);
      throw new Error(`Failed to check existing content: ${checkError.message}`);
    }

    if (existingTasks && existingTasks.length >= 5) {
      console.log('✅ Content already exists for campaign:', existingTasks.length, 'tasks');
      return {
        success: true,
        message: `Found ${existingTasks.length} existing content pieces`,
        tasks: existingTasks
      };
    }

    console.log('🚀 OPTIMIZED: Using parallel generation via generate_campaign_content function');
    
    // Use the optimized parallel generation function instead of sequential
    const { data: result, error } = await supabase.functions.invoke('generate_campaign_content', {
      body: {
        campaign_id: campaignId,
        campaign_title: campaignTheme,
        description: campaignDescription,
        user_id: userId,
        week_number: weekNumber,
        tenant_id: tenantId
      }
    });
    
    if (error) {
      console.error('❌ Optimized campaign generation error:', error);
      throw new Error(`Failed to generate campaign content: ${error.message}`);
    }
    
    if (!result.success) {
      throw new Error(`Generation failed: ${result.message}`);
    }
    
    console.log('✅ OPTIMIZED: Parallel generation completed successfully');
    
    return {
      success: result.success,
      message: result.message,
      tasks: result.tasks || []
    };
    
  } catch (error) {
    console.error('❌ Campaign content generation failed:', error);
    throw error;
  }
};
