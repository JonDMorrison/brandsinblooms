import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if a content task already exists for a specific campaign and post type
 */
export async function checkTaskExists(
  campaignId: string,
  postType: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('content_tasks')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('post_type', postType)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking task existence:', error);
    return false;
  }

  return !!data;
}

/**
 * Gets all existing post types for a campaign
 */
export async function getExistingPostTypes(
  campaignId: string,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('content_tasks')
    .select('post_type')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching existing post types:', error);
    return [];
  }

  return data?.map(t => t.post_type) || [];
}

/**
 * Filters out post types that already exist for a campaign
 */
export async function filterOutExistingTypes(
  campaignId: string,
  postTypes: string[],
  userId: string
): Promise<string[]> {
  const existingTypes = await getExistingPostTypes(campaignId, userId);
  return postTypes.filter(type => !existingTypes.includes(type));
}

/**
 * Safely creates a content task, preventing duplicates
 */
export async function createTaskIfNotExists(
  taskData: {
    campaign_id: string;
    post_type: string;
    user_id: string;
    status?: string;
    scheduled_date?: string;
    [key: string]: any;
  }
): Promise<{ success: boolean; taskId?: string; existed?: boolean }> {
  // Check if task already exists
  const exists = await checkTaskExists(
    taskData.campaign_id,
    taskData.post_type,
    taskData.user_id
  );

  if (exists) {
    console.log(`✓ Task already exists: ${taskData.post_type} for campaign ${taskData.campaign_id}`);
    return { success: true, existed: true };
  }

  // Create the task
  const { data, error } = await supabase
    .from('content_tasks')
    .insert(taskData)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return { success: false };
  }

  console.log(`✓ Created new task: ${taskData.post_type} for campaign ${taskData.campaign_id}`);
  return { success: true, taskId: data.id, existed: false };
}
