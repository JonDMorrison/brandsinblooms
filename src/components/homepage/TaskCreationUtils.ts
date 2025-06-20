
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

export const updateVideoTasksWithNewScript = async (campaignId: string, campaignTitle: string, userId?: string, campaignDescription?: string) => {
  try {
    const newVideoScript = await generateVideoScript(campaignTitle, userId, campaignDescription);
    
    // FIXED: Set to 'review' instead of 'completed' to require approval
    const { error } = await supabase
      .from('content_tasks')
      .update({ 
        ai_output: newVideoScript,
        status: 'review'
      })
      .eq('campaign_id', campaignId)
      .eq('post_type', 'video');

    if (error) {
      console.error('Error updating video script:', error);
    } else {
      console.log('Video script updated and requires approval');
    }
  } catch (error) {
    console.error('Error updating video script:', error);
  }
};

export const createMissingTasks = async (campaignId: string, missingTypes: string[], campaignTitle: string, userId?: string, campaignDescription?: string) => {
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
        // FIXED: Use structured newsletter generation for newsletters
        if (postType === 'newsletter') {
          aiOutput = await generateNewsletterContent(campaignId, campaignTitle, weekNumber, userId, campaignDescription);
        } else if (postType === 'video') {
          aiOutput = await generateVideoScript(campaignTitle, userId, campaignDescription);
        } else {
          aiOutput = await generatePersonalizedContent(postType, campaignTitle, userId, campaignDescription);
        }
      } catch (error) {
        console.error(`Error generating ${postType} content with OpenAI:`, error);
        throw new Error(`Failed to generate ${postType} content. Please ensure OpenAI API key is configured.`);
      }
      
      // FIXED: Set status to 'review' instead of 'completed' and include user_id
      tasksToCreate.push({
        campaign_id: campaignId,
        post_type: postType,
        status: 'review',
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        ai_output: aiOutput,
        hashtags: getHashtagsForType(postType),
        image_idea: getImageIdeaForType(postType),
        user_id: userId  // IMPORTANT: Include user_id for RLS
      });
    }

    if (tasksToCreate.length > 0) {
      console.log('Creating missing tasks for review:', tasksToCreate.map(t => t.post_type));

      const { data: createdTasks, error } = await supabase
        .from('content_tasks')
        .insert(tasksToCreate)
        .select();
      
      if (error) {
        console.error('Error creating missing tasks:', error);
        throw error;
      } else {
        console.log('Missing tasks created and require approval');
        
        // FIXED: Enhanced image generation for visual content types
        for (const task of createdTasks || []) {
          if (task.post_type === 'facebook' || task.post_type === 'instagram' || task.post_type === 'blog') {
            try {
              const imageQuery = `${campaignTitle} garden center ${task.post_type} plants flowers gardening`;
              console.log(`🖼️ Generating images for ${task.post_type} with query:`, imageQuery);
              
              const { data: imageData, error: imageError } = await supabase.functions.invoke('fetch-unsplash-images', {
                body: { 
                  query: imageQuery,
                  contentTaskId: task.id 
                }
              });
              
              if (imageError) {
                console.warn(`⚠️ Image generation failed for ${task.post_type}, creating placeholder:`, imageError);
                // Create placeholder image suggestion
                await supabase
                  .from('image_suggestions')
                  .insert([{
                    content_task_id: task.id,
                    query: imageQuery,
                    thumb_url: `https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center`,
                    download_url: `https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&h=800&fit=crop&crop=center`,
                    alt: `${campaignTitle} garden center content`,
                    photographer: 'Placeholder Image',
                    unsplash_id: 'placeholder-garden'
                  }]);
              } else {
                console.log(`✅ Image generation successful for ${task.post_type}`);
              }
            } catch (imageError) {
              console.warn(`⚠️ Image generation exception for ${task.post_type}:`, imageError);
              // Don't fail the whole process for image issues
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error creating missing tasks:', error);
    throw error;
  }
};
