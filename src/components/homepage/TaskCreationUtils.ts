
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

export const updateVideoTasksWithNewScript = async (campaignId: string, campaignTitle: string, userId?: string) => {
  try {
    const newVideoScript = await generateVideoScript(campaignTitle, userId);
    
    const { error } = await supabase
      .from('content_tasks')
      .update({ 
        ai_output: newVideoScript,
        status: 'review' // Changed from 'completed' to 'review'
      })
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
    // First check if any of these "missing" types already exist to prevent duplicates
    const { data: existingTasks } = await supabase
      .from('content_tasks')
      .select('post_type')
      .eq('campaign_id', campaignId)
      .in('post_type', missingTypes);
    
    const existingTypes = existingTasks?.map(t => t.post_type) || [];
    const actuallyMissingTypes = missingTypes.filter(type => !existingTypes.includes(type));
    
    if (actuallyMissingTypes.length === 0) {
      console.log('No actually missing tasks to create');
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
        status: 'review', // Changed from 'completed' to 'review'
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        ai_output: aiOutput,
        hashtags: getHashtagsForType(postType),
        image_idea: getImageIdeaForType(postType)
      });
    }

    if (tasksToCreate.length > 0) {
      console.log('Creating missing tasks:', tasksToCreate.map(t => t.post_type));

      const { error } = await supabase
        .from('content_tasks')
        .insert(tasksToCreate);
      
      if (error) {
        console.error('Error creating missing tasks:', error);
        throw error;
      } else {
        console.log('Missing tasks created successfully');
      }
    }
  } catch (error) {
    console.error('Error creating missing tasks:', error);
    throw error;
  }
};
