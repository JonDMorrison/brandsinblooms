
import { supabase } from "@/integrations/supabase/client";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { 
  generateNewsletterContent, 
  generateVideoScript, 
  generatePersonalizedContent
} from "./ContentGenerationServices";
import { 
  getHashtagsForType, 
  getImageIdeaForType 
} from "./ContentMetadataUtils";

export const updateVideoTasksWithNewScript = async (campaignId: string, campaignTitle: string, userId?: string, campaignDescription?: string, tenantId?: string) => {
  try {
    const newVideoScript = await generateVideoScript(campaignTitle, userId, campaignDescription);
    
    // 🔒 SECURITY: Ensure only tasks belonging to the user are updated
    let updateQuery = supabase
      .from('content_tasks')
      .update({ 
        ai_output: newVideoScript,
        status: 'review'
      })
      .eq('campaign_id', campaignId)
      .eq('post_type', 'video');

    // Apply proper isolation based on available data
    if (tenantId) {
      updateQuery = updateQuery.eq('tenant_id', tenantId);
    } else if (userId) {
      updateQuery = updateQuery.eq('user_id', userId);
    }

    const { error } = await updateQuery;

    if (error) {
      console.error('❌ Error updating video script:', error);
    } else {
      console.log('✅ Video script updated with proper user isolation');
    }
  } catch (error) {
    console.error('❌ Error updating video script:', error);
  }
};

export const createMissingTasks = async (campaignId: string, missingTypes: string[], campaignTitle: string, userId?: string, campaignDescription?: string, tenantId?: string) => {
  try {
    if (!userId) {
      console.error('❌ SECURITY: Cannot create tasks without user_id');
      throw new Error('User ID is required for task creation');
    }

    // First check if any of these "missing" types already exist to prevent duplicates
    let existingTasksQuery = supabase
      .from('content_tasks')
      .select('post_type')
      .eq('campaign_id', campaignId)
      .in('post_type', missingTypes);

    // Apply proper isolation for checking existing tasks
    if (tenantId) {
      existingTasksQuery = existingTasksQuery.eq('tenant_id', tenantId);
    } else {
      existingTasksQuery = existingTasksQuery.eq('user_id', userId);
    }

    const { data: existingTasks } = await existingTasksQuery;
    
    const existingTypes = existingTasks?.map(t => t.post_type) || [];
    const actuallyMissingTypes = missingTypes.filter(type => !existingTypes.includes(type));
    
    if (actuallyMissingTypes.length === 0) {
      console.log('✅ No actually missing tasks to create');
      return;
    }
    
    const today = new Date();
    const weekNumber = getCurrentWeekNumber();
    
    const tasksToCreate = [];
    
    for (let i = 0; i < actuallyMissingTypes.length; i++) {
      const postType = actuallyMissingTypes[i];
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + i + 1);
      
      let aiOutput = '';
      
      try {
        if (postType === 'newsletter') {
          aiOutput = await generateNewsletterContent(campaignId, campaignTitle, weekNumber, userId, campaignDescription);
        } else if (postType === 'video') {
          aiOutput = await generateVideoScript(campaignTitle, userId, campaignDescription);
        } else {
          aiOutput = await generatePersonalizedContent(postType, campaignTitle, userId, campaignDescription);
        }
      } catch (error) {
        console.error(`❌ Error generating ${postType} content with OpenAI:`, error);
        throw new Error(`Failed to generate ${postType} content. Please ensure OpenAI API key is configured.`);
      }
      
      // 🔒 SECURITY: Always include user_id and tenant_id for proper isolation
      const taskData = {
        campaign_id: campaignId,
        post_type: postType,
        status: 'review',
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        ai_output: aiOutput,
        hashtags: getHashtagsForType(postType),
        image_idea: getImageIdeaForType(postType),
        user_id: userId, // 🔒 CRITICAL: Always set user_id for RLS
        created_by_user_id: userId, // 🔒 Track who created it
        ...(tenantId && { tenant_id: tenantId }) // 🔒 Set tenant_id if available
      };

      tasksToCreate.push(taskData);
    }

    if (tasksToCreate.length > 0) {
      console.log('🔒 SECURITY: Creating missing tasks with proper user isolation:', {
        user_id: userId,
        tenant_id: tenantId || 'none',
        task_count: tasksToCreate.length,
        post_types: tasksToCreate.map(t => t.post_type)
      });

      const { error } = await supabase
        .from('content_tasks')
        .insert(tasksToCreate);
      
      if (error) {
        console.error('❌ Error creating missing tasks:', error);
        throw error;
      } else {
        console.log('✅ Missing tasks created with proper user isolation');
      }
    }
  } catch (error) {
    console.error('❌ Error creating missing tasks:', error);
    throw error;
  }
};
