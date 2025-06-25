
import { supabase } from "@/integrations/supabase/client";
import { generateCampaignContent } from "./ContentGenerationServices";

export const generateRequiredTasks = async (
  campaignId: string,
  campaigns: any[],
  userId: string,
  onTaskUpdate: () => void,
  tenantId?: string
) => {
  console.log('🎯 RequiredTasksGenerator: Starting task generation for campaign:', campaignId);

  try {
    // Find the specific campaign
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) {
      console.error('❌ Campaign not found:', campaignId);
      throw new Error('Campaign not found');
    }

    console.log('📋 Found campaign:', campaign.title, 'Week:', campaign.week_number);

    // Check if tasks already exist
    const { data: existingTasks, error: checkError } = await supabase
      .from('content_tasks')
      .select('id, post_type, status')
      .eq('campaign_id', campaignId);

    if (checkError) {
      console.error('❌ Error checking existing tasks:', checkError);
      throw new Error(`Failed to check existing tasks: ${checkError.message}`);
    }

    if (existingTasks && existingTasks.length > 0) {
      console.log('✅ Tasks already exist for campaign:', existingTasks.length);
      onTaskUpdate();
      return;
    }

    // Generate content using the improved service
    const result = await generateCampaignContent(
      campaignId,
      campaign.theme || campaign.title,
      campaign.description || '',
      userId,
      campaign.week_number,
      tenantId
    );

    if (result.success) {
      console.log('🎉 Successfully generated tasks for campaign');
      onTaskUpdate(); // Refresh the UI
    } else {
      console.error('❌ Task generation failed:', result.message);
      throw new Error(result.message);
    }

  } catch (error) {
    console.error('❌ RequiredTasksGenerator error:', error);
    throw error;
  }
};
