
import { supabase } from "@/integrations/supabase/client";

export const generateRequiredTasks = async (
  campaignId: string,
  campaigns: any[],
  userId: string,
  onTaskUpdate: () => void
) => {
  console.log('=== GENERATE REQUIRED TASKS START ===');
  console.log('Parameters:', { campaignId, campaignsCount: campaigns.length, userId });
  
  const requiredPostTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
  
  try {
    // Get current tasks for this campaign
    console.log('Fetching existing tasks for campaign:', campaignId);
    const { data: existingTasks, error: fetchError } = await supabase
      .from('content_tasks')
      .select('post_type')
      .eq('campaign_id', campaignId);

    if (fetchError) {
      console.error('Error fetching existing tasks:', fetchError);
      throw new Error(`Failed to fetch existing tasks: ${fetchError.message}`);
    }

    console.log('Existing tasks found:', existingTasks);
    const existingPostTypes = existingTasks?.map(task => task.post_type) || [];
    const missingPostTypes = requiredPostTypes.filter(type => !existingPostTypes.includes(type));

    console.log('Missing post types:', missingPostTypes);

    if (missingPostTypes.length === 0) {
      console.log('All required tasks already exist for campaign:', campaignId);
      return { message: 'All tasks already exist' };
    }

    // Find the campaign
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) {
      console.error('Campaign not found:', campaignId);
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    console.log(`Creating ${missingPostTypes.length} missing tasks for campaign:`, campaign.title);

    // Create tasks for missing post types without assigned_user_id to avoid foreign key constraint
    const tasksToCreate = missingPostTypes.map(postType => ({
      campaign_id: campaignId,
      post_type: postType,
      status: 'generating', // Start with generating status
      scheduled_date: campaign.start_date
      // Removed assigned_user_id to avoid foreign key constraint violation
    }));

    console.log('Tasks to create:', tasksToCreate);

    const { data: createdTasks, error: createError } = await supabase
      .from('content_tasks')
      .insert(tasksToCreate)
      .select();

    if (createError) {
      console.error('Error creating tasks:', createError);
      throw new Error(`Failed to create content tasks: ${createError.message}`);
    }

    console.log('Created tasks:', createdTasks);

    // Generate content for each task
    if (createdTasks) {
      for (const task of createdTasks) {
        try {
          console.log(`=== Generating content for ${task.post_type} ===`);
          console.log('Task details:', task);
          
          console.log('About to call supabase.functions.invoke with:', {
            functionName: 'generate-content',
            body: {
              postType: task.post_type,
              campaignTitle: campaign.title,
              userId: userId,
              weekDescription: campaign.description
            }
          });
          
          const response = await supabase.functions.invoke('generate-content', {
            body: {
              postType: task.post_type,
              campaignTitle: campaign.title,
              userId: userId,
              weekDescription: campaign.description
            }
          });

          console.log('Supabase function response:', response);

          if (response.error) {
            console.error(`Error from generate-content function for ${task.post_type}:`, response.error);
            // Update task status to indicate error
            await supabase
              .from('content_tasks')
              .update({ status: 'planned' })
              .eq('id', task.id);
            
            // Don't throw here, continue with other tasks
            console.log(`Continuing with other tasks despite ${task.post_type} failure`);
            continue;
          }

          console.log('Raw response data:', response.data);
          const { content } = response.data;
          
          if (!content) {
            console.error(`No content returned for ${task.post_type}. Full response:`, response.data);
            await supabase
              .from('content_tasks')
              .update({ status: 'planned' })
              .eq('id', task.id);
            continue;
          }
          
          // Update task with generated content and set status to 'draft' for review
          console.log(`Updating task ${task.id} with generated content`);
          const { error: updateError } = await supabase
            .from('content_tasks')
            .update({ 
              ai_output: content,
              status: 'draft' // Set to draft so content appears in review queue
            })
            .eq('id', task.id);

          if (updateError) {
            console.error(`Error updating task ${task.id}:`, updateError);
          } else {
            console.log(`Generated ${task.post_type} content successfully`);
          }
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
    
    return { message: 'Content generation completed', tasksCreated: createdTasks?.length || 0 };
    
  } catch (error) {
    console.error('=== ERROR IN GENERATE REQUIRED TASKS ===');
    console.error('Error details:', error);
    throw error;
  } finally {
    console.log('=== GENERATE REQUIRED TASKS END ===');
  }
};
