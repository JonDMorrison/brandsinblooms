
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ContentGenerationResult {
  success: boolean;
  message: string;
  tasks?: any[];
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

    // Define content types to generate
    const contentTypes = [
      'facebook',
      'instagram', 
      'newsletter',
      'blog',
      'video'
    ];

    console.log('🔄 Generating content for types:', contentTypes);

    const generatedTasks = [];
    const errors = [];

    // Generate content for each type
    for (const contentType of contentTypes) {
      try {
        console.log(`🎨 Generating ${contentType} content...`);

        // Create the content task first
        const taskData = {
          campaign_id: campaignId,
          user_id: userId,
          tenant_id: tenantId,
          post_type: contentType,
          status: 'generating',
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

        // Generate content using the edge function
        const { data: contentResult, error: contentError } = await supabase.functions.invoke('generate-content', {
          body: {
            postType: contentType,
            campaignTitle: campaignTheme,
            userId: userId,
            weekDescription: campaignDescription,
            enforceCompanyName: true
          }
        });

        if (contentError) {
          console.error(`❌ Error generating ${contentType} content:`, contentError);
          errors.push(`Failed to generate ${contentType} content: ${contentError.message}`);
          
          // Update task status to failed
          await supabase
            .from('content_tasks')
            .update({ 
              status: 'failed',
              notes: `Generation failed: ${contentError.message}`
            })
            .eq('id', newTask.id);
          
          continue;
        }

        if (!contentResult?.content) {
          console.error(`❌ No content returned for ${contentType}`);
          errors.push(`No content generated for ${contentType}`);
          
          // Update task status to failed
          await supabase
            .from('content_tasks')
            .update({ 
              status: 'failed',
              notes: 'No content returned from generation'
            })
            .eq('id', newTask.id);
          
          continue;
        }

        // Update task with generated content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({
            ai_output: contentResult.content,
            status: 'review',
            notes: `Generated successfully with ${contentResult.generationAttempts || 1} attempts`
          })
          .eq('id', newTask.id);

        if (updateError) {
          console.error(`❌ Error updating ${contentType} task:`, updateError);
          errors.push(`Failed to save ${contentType} content: ${updateError.message}`);
          continue;
        }

        console.log(`🎉 Successfully generated ${contentType} content`);
        generatedTasks.push({
          ...newTask,
          ai_output: contentResult.content,
          status: 'review'
        });

        // Add a small delay between generations to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Unexpected error generating ${contentType}:`, error);
        errors.push(`Unexpected error for ${contentType}: ${error.message}`);
      }
    }

    console.log('🏁 Content generation completed:', {
      successful: generatedTasks.length,
      failed: errors.length,
      errors: errors
    });

    if (generatedTasks.length === 0) {
      throw new Error(`Failed to generate any content. Errors: ${errors.join(', ')}`);
    }

    return {
      success: true,
      message: `Generated ${generatedTasks.length} content pieces${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
      tasks: generatedTasks
    };

  } catch (error) {
    console.error('❌ Campaign content generation failed:', error);
    return {
      success: false,
      message: error.message || 'Content generation failed'
    };
  }
};

export const regenerateTaskContent = async (taskId: string, userId: string): Promise<boolean> => {
  try {
    console.log('🔄 Regenerating content for task:', taskId);

    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('content_tasks')
      .select(`
        *,
        campaigns (
          title,
          theme,
          description
        )
      `)
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (taskError || !task) {
      console.error('❌ Error fetching task:', taskError);
      return false;
    }

    // Update task status to generating
    await supabase
      .from('content_tasks')
      .update({ status: 'generating' })
      .eq('id', taskId);

    // Generate new content
    const { data: contentResult, error: contentError } = await supabase.functions.invoke('generate-content', {
      body: {
        postType: task.post_type,
        campaignTitle: task.campaigns?.title || task.campaigns?.theme,
        userId: userId,
        weekDescription: task.campaigns?.description,
        enforceCompanyName: true
      }
    });

    if (contentError || !contentResult?.content) {
      console.error('❌ Error regenerating content:', contentError);
      
      // Update task status back to review or failed
      await supabase
        .from('content_tasks')
        .update({ 
          status: 'failed',
          notes: `Regeneration failed: ${contentError?.message || 'No content generated'}`
        })
        .eq('id', taskId);
      
      return false;
    }

    // Update task with new content
    const { error: updateError } = await supabase
      .from('content_tasks')
      .update({
        ai_output: contentResult.content,
        status: 'review',
        notes: `Regenerated successfully with ${contentResult.generationAttempts || 1} attempts`
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('❌ Error updating regenerated task:', updateError);
      return false;
    }

    console.log('🎉 Successfully regenerated content for task:', taskId);
    return true;

  } catch (error) {
    console.error('❌ Task regeneration failed:', error);
    return false;
  }
};
