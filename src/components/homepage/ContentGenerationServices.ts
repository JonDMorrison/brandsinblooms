
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

        // Create the content task with 'scheduled' status instead of 'generating'
        const taskData = {
          campaign_id: campaignId,
          user_id: userId,
          tenant_id: tenantId,
          post_type: contentType,
          status: 'scheduled', // Changed from 'generating' to 'scheduled'
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
          continue;
        }

        if (!contentResult?.content) {
          console.error(`❌ No content generated for ${contentType}`);
          errors.push(`No content generated for ${contentType}`);
          continue;
        }

        // Update the task with the generated content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({ 
            ai_output: contentResult.content,
            status: 'review' // Update to review status after generation
          })
          .eq('id', newTask.id);

        if (updateError) {
          console.error(`❌ Error updating ${contentType} task:`, updateError);
          errors.push(`Failed to update ${contentType} task: ${updateError.message}`);
          continue;
        }

        console.log(`✅ Generated and saved ${contentType} content`);
        generatedTasks.push({ ...newTask, ai_output: contentResult.content, status: 'review' });

      } catch (error) {
        console.error(`❌ Error in ${contentType} generation:`, error);
        errors.push(`${contentType}: ${error.message}`);
      }
    }

    console.log('🏁 Content generation completed:', {
      successful: generatedTasks.length,
      failed: errors.length,
      errors
    });

    if (generatedTasks.length === 0) {
      throw new Error(`Failed to generate any content. Errors: ${errors.join(', ')}`);
    }

    return {
      success: true,
      message: `Generated ${generatedTasks.length}/${contentTypes.length} content pieces${errors.length > 0 ? `. Issues: ${errors.length}` : ''}`,
      tasks: generatedTasks
    };

  } catch (error) {
    console.error('❌ Campaign content generation failed:', error);
    throw error;
  }
};
