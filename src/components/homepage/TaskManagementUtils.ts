import { supabase } from "@/integrations/supabase/client";
import { getCurrentWeekNumber } from "./homepageUtils";
import { 
  generateNewsletterContent, 
  generateVideoScript, 
  generatePersonalizedContent,
  getHashtagsForType, 
  getImageIdeaForType 
} from "./TaskGenerationUtils";

export const cleanupDuplicatesForCampaign = async (campaignId: string) => {
  try {
    // Get all tasks for this campaign
    const { data: allTasks, error } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (error || !allTasks) return;

    // Group by post_type and keep only the first one of each type
    const tasksByType = allTasks.reduce((acc: any, task: any) => {
      if (!acc[task.post_type]) {
        acc[task.post_type] = task;
      }
      return acc;
    }, {});

    // Find tasks to delete (duplicates)
    const tasksToKeep = Object.values(tasksByType).map((task: any) => task.id);
    const tasksToDelete = allTasks.filter(task => !tasksToKeep.includes(task.id));

    if (tasksToDelete.length > 0) {
      console.log('Removing duplicate tasks:', tasksToDelete.map(t => `${t.post_type} (${t.id})`));
      
      const { error: deleteError } = await supabase
        .from('content_tasks')
        .delete()
        .in('id', tasksToDelete.map(t => t.id));

      if (deleteError) {
        console.error('Error deleting duplicate tasks:', deleteError);
      } else {
        console.log('Successfully cleaned up duplicates');
      }
    }
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
  }
};

export const updateVideoTasksWithNewScript = async (campaignId: string, campaignTitle: string, userId?: string) => {
  try {
    const newVideoScript = await generateVideoScript(campaignTitle, userId);
    
    const { error } = await supabase
      .from('content_tasks')
      .update({ ai_output: newVideoScript })
      .eq('campaign_id', campaignId)
      .eq('post_type', 'video');

    if (error) {
      console.error('Error updating video script:', error);
    } else {
      console.log('Video script updated with OpenAI-generated content');
    }
  } catch (error) {
    console.error('Error updating video script:', error);
  }
};

export const createMissingTasks = async (campaignId: string, missingTypes: string[], campaignTitle: string, userId?: string) => {
  try {
    const today = new Date();
    const weekNumber = getCurrentWeekNumber();
    
    const tasksToCreate = [];
    
    for (let i = 0; i < missingTypes.length; i++) {
      const postType = missingTypes[i];
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + i + 1);
      
      let aiOutput = '';
      
      try {
        if (postType === 'newsletter') {
          aiOutput = await generateNewsletterContent(campaignId, campaignTitle, weekNumber, userId);
        } else if (postType === 'video') {
          aiOutput = await generateVideoScript(campaignTitle, userId);
        } else {
          aiOutput = await generatePersonalizedContent(postType, campaignTitle, userId);
        }
      } catch (error) {
        console.error(`Error generating ${postType} content with OpenAI:`, error);
        throw new Error(`Failed to generate ${postType} content. Please ensure OpenAI API key is configured.`);
      }
      
      tasksToCreate.push({
        campaign_id: campaignId,
        post_type: postType,
        status: 'review',
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        ai_output: aiOutput,
        hashtags: getHashtagsForType(postType),
        image_idea: getImageIdeaForType(postType)
      });
    }

    console.log('Creating OpenAI-generated missing tasks:', tasksToCreate);

    const { error } = await supabase
      .from('content_tasks')
      .insert(tasksToCreate);
    
    if (error) {
      console.error('Error creating missing tasks:', error);
      throw error;
    } else {
      console.log('OpenAI-generated missing tasks created successfully');
    }
  } catch (error) {
    console.error('Error creating missing tasks:', error);
    throw error;
  }
};

export const generateRequiredTasks = async (campaignId: string, campaigns: any[], userId?: string, onTaskUpdate?: () => void) => {
  try {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    const today = new Date();
    const weekNumber = getCurrentWeekNumber();
    
    // Generate exactly 5 required tasks with OpenAI
    const requiredTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
    const sampleTasks = [];
    
    for (let i = 0; i < requiredTypes.length; i++) {
      const postType = requiredTypes[i];
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + i + 1);
      
      let aiOutput = '';
      
      try {
        if (postType === 'newsletter') {
          aiOutput = await generateNewsletterContent(campaignId, campaign.title, weekNumber, userId);
        } else if (postType === 'video') {
          aiOutput = await generateVideoScript(campaign.title, userId);
        } else {
          aiOutput = await generatePersonalizedContent(postType, campaign.title, userId);
        }
      } catch (error) {
        console.error(`Error generating ${postType} content with OpenAI:`, error);
        throw new Error(`Failed to generate ${postType} content. Please ensure OpenAI API key is configured.`);
      }
      
      sampleTasks.push({
        campaign_id: campaignId,
        post_type: postType,
        status: 'review',
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        ai_output: aiOutput,
        hashtags: getHashtagsForType(postType),
        image_idea: getImageIdeaForType(postType)
      });
    }

    console.log('Auto-generating OpenAI-powered required tasks:', sampleTasks);

    const { data, error } = await supabase
      .from('content_tasks')
      .insert(sampleTasks)
      .select();
    
    if (error) {
      console.error('Error creating tasks:', error);
      throw error;
    } else {
      console.log('OpenAI-generated tasks created successfully:', data);
    }

    if (onTaskUpdate) {
      onTaskUpdate();
    }
    
  } catch (error) {
    console.error('Error generating tasks:', error);
    throw error;
  }
};
