import { supabase } from "@/integrations/supabase/client";

export const cleanupDuplicatesForCampaign = async (campaignId: string) => {
  try {
    console.log('Cleaning up duplicates for campaign:', campaignId);
    
    // Get all tasks for this campaign
    const { data: allTasks, error } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (error || !allTasks) {
      console.error('Error fetching tasks for cleanup:', error);
      return;
    }

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
        console.log('Successfully cleaned up', tasksToDelete.length, 'duplicate tasks');
      }
    } else {
      console.log('No duplicates found for campaign:', campaignId);
    }
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
  }
};
