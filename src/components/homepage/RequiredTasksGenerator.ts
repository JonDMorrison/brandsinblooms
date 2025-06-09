
import { supabase } from "@/integrations/supabase/client";
import { getCurrentWeekNumber } from "./homepageUtils";
import { 
  generateNewsletterContent, 
  generateVideoScript, 
  generatePersonalizedContent,
  getHashtagsForType, 
  getImageIdeaForType 
} from "./TaskGenerationUtils";
import { cleanupDuplicatesForCampaign } from "./CleanupUtils";

export const generateRequiredTasks = async (campaignId: string, campaigns: any[], userId?: string, onTaskUpdate?: () => void) => {
  try {
    console.log('Starting generateRequiredTasks for campaign:', campaignId);
    console.log('Available campaigns:', campaigns.map(c => ({ id: c.id, title: c.title })));
    
    // First check if tasks already exist for this campaign
    const { data: existingTasks, error: checkError } = await supabase
      .from('content_tasks')
      .select('post_type')
      .eq('campaign_id', campaignId);

    if (checkError) {
      console.error('Error checking existing tasks:', checkError);
      throw checkError;
    }

    if (existingTasks && existingTasks.length > 0) {
      console.log(`Campaign ${campaignId} already has ${existingTasks.length} tasks, skipping generation`);
      
      // Clean up any duplicates that might exist
      await cleanupDuplicatesForCampaign(campaignId);
      
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      return;
    }

    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) {
      console.error('Campaign not found with ID:', campaignId);
      throw new Error('Campaign not found');
    }

    console.log('Found campaign for content generation:', campaign);

    // Ensure we have a campaign title - use theme, title, or fallback
    const campaignTitle = campaign.title || campaign.theme || 'Garden Center Campaign';
    console.log('Using campaign title for content generation:', campaignTitle);

    const today = new Date();
    const weekNumber = getCurrentWeekNumber();
    
    // Generate exactly 5 required tasks with OpenAI and set them as approved
    const requiredTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
    const sampleTasks = [];
    
    for (let i = 0; i < requiredTypes.length; i++) {
      const postType = requiredTypes[i];
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + i + 1);
      
      let aiOutput = '';
      
      try {
        console.log(`Generating ${postType} content for campaign: ${campaignTitle}`);
        
        if (postType === 'newsletter') {
          aiOutput = await generateNewsletterContent(campaignId, campaignTitle, weekNumber, userId);
        } else if (postType === 'video') {
          aiOutput = await generateVideoScript(campaignTitle, userId);
        } else {
          aiOutput = await generatePersonalizedContent(postType, campaignTitle, userId);
        }
        
        console.log(`Successfully generated ${postType} content`);
      } catch (error) {
        console.error(`Error generating ${postType} content with OpenAI:`, error);
        throw new Error(`Failed to generate ${postType} content. Please ensure OpenAI API key is configured. Error: ${error.message}`);
      }
      
      sampleTasks.push({
        campaign_id: campaignId,
        post_type: postType,
        status: 'approved', // Skip review, go directly to approved
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        ai_output: aiOutput,
        hashtags: getHashtagsForType(postType),
        image_idea: getImageIdeaForType(postType)
      });
    }

    console.log('Creating 5 approved tasks for campaign:', campaignId);

    const { data, error } = await supabase
      .from('content_tasks')
      .insert(sampleTasks)
      .select();
    
    if (error) {
      console.error('Error creating tasks:', error);
      throw error;
    } else {
      console.log('5 OpenAI-generated approved tasks created successfully:', data?.length || 0);
    }

    // Clean up any potential duplicates after creation
    await cleanupDuplicatesForCampaign(campaignId);

    if (onTaskUpdate) {
      onTaskUpdate();
    }
    
  } catch (error) {
    console.error('Error generating tasks:', error);
    throw error;
  }
};
