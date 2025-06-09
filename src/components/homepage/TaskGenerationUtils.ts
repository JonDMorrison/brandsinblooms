
import { supabase } from "@/integrations/supabase/client";

export const ensureCampaignHasTasks = async (campaigns: any[], userId: string, onTaskUpdate: () => void) => {
  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found, skipping task generation.');
    return;
  }

  for (const campaign of campaigns) {
    if (!campaign.id) {
      console.warn('Campaign missing ID, skipping task generation for this campaign.');
      continue;
    }

    // Fetch existing tasks for the campaign
    const { data: existingTasks, error: fetchError } = await supabase
      .from('content_tasks')
      .select('id')
      .eq('campaign_id', campaign.id);

    if (fetchError) {
      console.error('Error fetching existing tasks:', fetchError);
      continue;
    }

    const numberOfExistingTasks = existingTasks ? existingTasks.length : 0;
    const numberOfTasksToCreate = Math.max(0, 5 - numberOfExistingTasks);

    if (numberOfTasksToCreate > 0) {
      console.log(`Creating ${numberOfTasksToCreate} tasks for campaign: ${campaign.title}`);

      for (let i = 0; i < numberOfTasksToCreate; i++) {
        const newTask = {
          campaign_id: campaign.id,
          user_id: userId,
          status: 'planned',
          post_type: ['facebook', 'instagram', 'email'][i % 3],
          scheduled_date: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from('content_tasks')
          .insert([newTask]);

        if (insertError) {
          console.error('Error creating task:', insertError);
        } else {
          console.log('New task created for campaign:', campaign.title);
          onTaskUpdate();
        }
      }
    } else {
      console.log(`Campaign "${campaign.title}" already has 5 or more tasks. Skipping.`);
    }
  }
};

export const generateContentForTask = async (task: any, companyProfile: any) => {
  console.log('Starting content generation for task:', task.id);
  
  try {
    // Update task status to generating
    const { error: updateError } = await supabase
      .from('content_tasks')
      .update({ status: 'generating' })
      .eq('id', task.id);

    if (updateError) {
      console.error('Error updating task status to generating:', updateError);
      return;
    }

    console.log('Calling generate-content function for task:', task.id);
    
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        taskId: task.id,
        postType: task.post_type,
        campaignTheme: task.campaigns?.theme || 'General business content',
        campaignTitle: task.campaigns?.title || 'Content Campaign',
        scheduledDate: task.scheduled_date,
        companyProfile: companyProfile
      }
    });

    if (error) {
      console.error('Error generating content:', error);
      // Update status back to planned if generation fails
      await supabase
        .from('content_tasks')
        .update({ status: 'planned' })
        .eq('id', task.id);
      throw error;
    }

    console.log('Content generation response:', data);

    // Update task with generated content and set status to draft for review
    const { error: contentUpdateError } = await supabase
      .from('content_tasks')
      .update({ 
        ai_output: data.content,
        hashtags: data.hashtags || '',
        image_idea: data.imageIdea || '',
        status: 'draft' // Changed from 'scheduled' to 'draft'
      })
      .eq('id', task.id);

    if (contentUpdateError) {
      console.error('Error updating task with generated content:', contentUpdateError);
      throw contentUpdateError;
    }

    console.log('Successfully generated and saved content for task:', task.id);
    return data;

  } catch (error) {
    console.error('Error in generateContentForTask:', error);
    
    // Reset status to planned if anything fails
    await supabase
      .from('content_tasks')
      .update({ status: 'planned' })
      .eq('id', task.id);
    
    throw error;
  }
};

export const generatePersonalizedContent = async (postType: string, campaignTitle: string, userId?: string) => {
  console.log(`Generating ${postType} content for: ${campaignTitle}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType: postType,
        campaignTheme: campaignTitle,
        campaignTitle: campaignTitle,
        userId: userId
      }
    });

    if (error) {
      console.error('Error generating personalized content:', error);
      throw error;
    }

    return data.content || data.generatedText || `Generated ${postType} content for ${campaignTitle}`;
  } catch (error) {
    console.error('Error in generatePersonalizedContent:', error);
    throw error;
  }
};

export const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number, userId?: string) => {
  console.log(`Generating newsletter content for campaign: ${campaignTitle} (Week ${weekNumber})`);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        campaignId: campaignId,
        campaignTitle: campaignTitle,
        weekNumber: weekNumber,
        userId: userId
      }
    });

    if (error) {
      console.error('Error generating newsletter content:', error);
      throw error;
    }

    return data.content || data.generatedText || `Generated newsletter content for ${campaignTitle}`;
  } catch (error) {
    console.error('Error in generateNewsletterContent:', error);
    throw error;
  }
};

export const generateVideoScript = async (campaignTitle: string, userId?: string) => {
  console.log(`Generating video script for: ${campaignTitle}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-video-script', {
      body: {
        campaignTitle: campaignTitle,
        userId: userId
      }
    });

    if (error) {
      console.error('Error generating video script:', error);
      throw error;
    }

    return data.script || data.generatedText || `Generated video script for ${campaignTitle}`;
  } catch (error) {
    console.error('Error in generateVideoScript:', error);
    throw error;
  }
};

export const getHashtagsForType = (postType: string): string => {
  const hashtagsMap: Record<string, string> = {
    instagram: '#business #entrepreneur #success #motivation #growth',
    facebook: '#business #community #update #news',
    email: '',
    newsletter: '',
    video: '#video #content #business #tips'
  };
  
  return hashtagsMap[postType] || '#business #content';
};

export const getImageIdeaForType = (postType: string): string => {
  const imageIdeasMap: Record<string, string> = {
    instagram: 'Professional photo with engaging visual elements',
    facebook: 'Community-focused image or infographic',
    email: 'Simple header image or company logo',
    newsletter: 'Newsletter banner with company branding',
    video: 'Thumbnail image for video content'
  };
  
  return imageIdeasMap[postType] || 'Professional business image';
};
