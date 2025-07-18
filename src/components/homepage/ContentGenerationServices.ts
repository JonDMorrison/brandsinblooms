
import { supabase } from "@/integrations/supabase/client";
import { memoryCache, apiDeduplicator } from '@/utils/performanceOptimizations';
import { toast } from '@/utils/toast';
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
  try {
    console.log('🎯 Generating campaign content using optimized function...', {
      campaignId,
      campaignTheme,
      userId,
      weekNumber,
      tenantId
    });

    // Create cache key for deduplication
    const cacheKey = `campaign-${campaignId}-${campaignTheme}-${weekNumber || 'current'}`;
    
    // Check cache first
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('✅ Using cached campaign content');
      return cached;
    }

    // Use deduplication to prevent multiple simultaneous requests
    return apiDeduplicator.dedupe(cacheKey, async () => {
      // Validate required parameters
      if (!campaignId || !userId) {
        throw new Error('Campaign ID and User ID are required');
      }

      // Check if content already exists (with caching)
      const existingCacheKey = `existing-tasks-${campaignId}`;
      let existingTasks = memoryCache.get(existingCacheKey);
      
      if (!existingTasks) {
        const { data: tasksData, error: checkError } = await supabase
          .from('content_tasks')
          .select('id, post_type, status')
          .eq('campaign_id', campaignId)
          .not('status', 'eq', 'cancelled');

        if (checkError) {
          throw new Error(`Failed to check existing content: ${checkError.message}`);
        }

        existingTasks = tasksData;
        // Cache for 1 minute
        memoryCache.set(existingCacheKey, existingTasks, 60000);
      }

      if (existingTasks && existingTasks.length >= 5) {
        console.log('✅ Content already exists for campaign:', existingTasks.length, 'tasks');
        const result = {
          success: true,
          message: `Found ${existingTasks.length} existing content pieces`,
          tasks: existingTasks
        };
        
        // Cache the result
        memoryCache.set(cacheKey, result, 300000);
        return result;
      }

      console.log('🚀 Using optimized parallel generation function');
      
      const { data, error } = await supabase.functions.invoke('generate_campaign_content', {
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
        console.error('❌ Campaign content generation error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Campaign content generation failed');
      }

      console.log('✅ Campaign content generated successfully:', data);
      
      const result = {
        success: true,
        message: data.message,
        tasks: data.tasks
      };

      // Cache the result for 5 minutes and clear the existing tasks cache
      memoryCache.set(cacheKey, result, 300000);
      memoryCache.delete(existingCacheKey);
      
      return result;
    });
  } catch (error) {
    console.error('❌ generateCampaignContent error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};
