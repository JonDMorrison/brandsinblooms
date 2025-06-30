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
  console.log('🎯 Starting campaign content generation:', {
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

    if (existingTasks && existingTasks.length > 0) {
      console.log('✅ Content already exists for campaign:', existingTasks.length, 'tasks');
      return {
        success: true,
        message: `Found ${existingTasks.length} existing content pieces`,
        tasks: existingTasks
      };
    }

    // Define content types to generate - prioritize reliable ones first
    const contentTypes = [
      'facebook',
      'instagram', 
      'blog',
      'newsletter',
      'video' // Keep video last as it seems to have issues
    ];

    console.log('🔄 Generating content for types:', contentTypes);

    const generatedTasks = [];
    const errors = [];

    // Generate content for each type with individual error handling
    for (const contentType of contentTypes) {
      try {
        console.log(`🎨 Generating ${contentType} content...`);

        // Create the content task with 'planned' status first
        const taskData = {
          campaign_id: campaignId,
          user_id: userId,
          tenant_id: tenantId,
          post_type: contentType,
          status: TASK_STATUS.PLANNED,
          scheduled_date: new Date().toISOString().split('T')[0]
        };

        const { data: newTask, error: taskError } = await supabase
          .from('content_tasks')
          .insert(taskData)
          .select()
          .single();

        if (taskError) {
          console.error(`❌ Error creating ${contentType} task:`, taskError);
          errors.push(`Failed to create ${contentType} task: ${taskError.message}`);
          continue;
        }

        console.log(`✅ Created ${contentType} task:`, newTask.id);

        // Generate content with timeout to prevent hanging
        const contentPromise = supabase.functions.invoke('generate-content', {
          body: {
            postType: contentType,
            campaignTitle: campaignTheme,
            userId: userId,
            weekDescription: campaignDescription,
            enforceCompanyName: true
          }
        });

        // Add timeout to prevent infinite waiting
        const timeoutPromise = new Promise<SupabaseFunctionResponse>((_, reject) => 
          setTimeout(() => reject(new Error(`${contentType} generation timeout`)), 30000)
        );

        const result = await Promise.race([
          contentPromise,
          timeoutPromise
        ]) as SupabaseFunctionResponse;

        if (result.error) {
          console.error(`❌ Error generating ${contentType} content:`, result.error);
          errors.push(`Failed to generate ${contentType} content: ${result.error.message}`);
          continue;
        }

        if (!result.data?.content) {
          console.error(`❌ No content generated for ${contentType}`);
          errors.push(`No content generated for ${contentType}`);
          continue;
        }

        // Update the task with the generated content and set status to 'approved'
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({ 
            ai_output: result.data.content,
            status: TASK_STATUS.APPROVED
          })
          .eq('id', newTask.id);

        if (updateError) {
          console.error(`❌ Error updating ${contentType} task:`, updateError);
          errors.push(`Failed to update ${contentType} task: ${updateError.message}`);
          continue;
        }

        console.log(`✅ Generated and saved ${contentType} content`);
        generatedTasks.push({ ...newTask, ai_output: result.data.content, status: TASK_STATUS.APPROVED });

      } catch (error) {
        console.error(`❌ Error in ${contentType} generation:`, error);
        errors.push(`${contentType}: ${error.message}`);
        
        // Continue with other content types even if this one fails
        continue;
      }
    }

    console.log('🏁 Content generation completed:', {
      successful: generatedTasks.length,
      failed: errors.length,
      errors
    });

    // Return success if we generated at least some content
    if (generatedTasks.length > 0) {
      // Add optimistic toast feedback
      toast.success(`✅ Content generated — ${generatedTasks.length} drafts added to tray`);
      
      return {
        success: true,
        message: `Generated ${generatedTasks.length}/${contentTypes.length} content pieces${errors.length > 0 ? `. Issues with: ${errors.length} items` : ''}`,
        tasks: generatedTasks
      };
    } else {
      throw new Error(`Failed to generate any content. Errors: ${errors.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Campaign content generation failed:', error);
    throw error;
  }
};
