
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import type { ContentTask } from './prompt-builder.ts';

export const fetchCampaignContent = async (
  supabase: ReturnType<typeof createClient>,
  campaignId: string
): Promise<ContentTask[]> => {
  try {
    const { data: contentTasks, error: tasksError } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('campaign_id', campaignId)
      .neq('post_type', 'newsletter');

    if (tasksError) {
      console.error('Error fetching content tasks:', tasksError);
      throw new Error('Failed to fetch campaign content');
    }

    return contentTasks?.map(task => ({
      type: task.post_type,
      content: task.ai_output,
      hashtags: task.hashtags,
      imageIdea: task.image_idea
    })) || [];
  } catch (error) {
    console.error('Error in fetchCampaignContent:', error);
    throw error;
  }
};

export const processAIResponse = (aiResponse: string, companyProfile: any, campaignTitle: string) => {
  let newsletterData;
  
  try {
    newsletterData = JSON.parse(aiResponse);
  } catch (parseError) {
    console.error('Failed to parse AI response as JSON:', aiResponse);
    // Fallback: create newsletter data from raw text
    const companyName = companyProfile?.company_name || 'Garden Center';
    newsletterData = {
      subject: `${companyName}: ${campaignTitle}`,
      content: aiResponse,
      summary: `Enhanced newsletter featuring ${campaignTitle} with improved writing style`
    };
  }

  return newsletterData;
};
