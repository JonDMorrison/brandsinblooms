
import { supabase } from "@/integrations/supabase/client";

export const generateRequiredTasks = async (
  campaignId: string,
  campaigns: any[],
  userId: string,
  onTaskUpdate: () => void
) => {
  const requiredPostTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
  
  // Get current tasks for this campaign
  const { data: existingTasks } = await supabase
    .from('content_tasks')
    .select('post_type')
    .eq('campaign_id', campaignId);

  const existingPostTypes = existingTasks?.map(task => task.post_type) || [];
  const missingPostTypes = requiredPostTypes.filter(type => !existingPostTypes.includes(type));

  if (missingPostTypes.length === 0) {
    console.log('All required tasks already exist for campaign:', campaignId);
    return;
  }

  // Find the campaign
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) {
    console.error('Campaign not found:', campaignId);
    return;
  }

  console.log(`Creating ${missingPostTypes.length} missing tasks for campaign:`, campaign.title);

  // Create tasks for missing post types
  const tasksToCreate = missingPostTypes.map(postType => ({
    campaign_id: campaignId,
    post_type: postType,
    status: 'generating', // Start with generating status
    scheduled_date: campaign.start_date,
    assigned_user_id: userId
  }));

  const { data: createdTasks, error } = await supabase
    .from('content_tasks')
    .insert(tasksToCreate)
    .select();

  if (error) {
    console.error('Error creating tasks:', error);
    throw new Error('Failed to create content tasks');
  }

  console.log('Created tasks:', createdTasks);

  // Generate content for each task
  if (createdTasks) {
    for (const task of createdTasks) {
      try {
        console.log(`Generating content for ${task.post_type}...`);
        
        const response = await supabase.functions.invoke('generate-content', {
          body: {
            postType: task.post_type,
            campaignTitle: campaign.title,
            userId: userId
          }
        });

        if (response.error) {
          console.error(`Error generating ${task.post_type} content:`, response.error);
          // Update task status to indicate error
          await supabase
            .from('content_tasks')
            .update({ status: 'planned' })
            .eq('id', task.id);
          continue;
        }

        const { content } = response.data;
        
        // Update task with generated content and set status to 'draft' for review
        await supabase
          .from('content_tasks')
          .update({ 
            ai_output: content,
            status: 'draft' // Changed from 'approved' to 'draft' so content appears in review queue
          })
          .eq('id', task.id);

        console.log(`Generated ${task.post_type} content successfully`);
      } catch (error) {
        console.error(`Error generating ${task.post_type} content:`, error);
        // Update task status to indicate error
        await supabase
          .from('content_tasks')
          .update({ status: 'planned' })
          .eq('id', task.id);
      }
    }
  }

  console.log('Content generation completed');
  onTaskUpdate();
};
