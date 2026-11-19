import { supabase } from "@/integrations/supabase/client";

// The server-side cleanup-duplicate-content function is retired (central-login 59, crm-r2-F24): duplicates of one
// campaign are removed with the signed-in user's own access only.
export const cleanupDuplicatesForCampaign = async (campaignId: string) => {
  await localCleanup(campaignId);
};

const localCleanup = async (campaignId: string) => {
  try {
    // Get all tasks for this campaign
    const { data: allTasks, error } = await supabase
      .from("content_tasks")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (error || !allTasks) {
      console.error("Error fetching tasks for fallback cleanup:", error);
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
    const tasksToDelete = allTasks.filter(
      (task) => !tasksToKeep.includes(task.id),
    );

    if (tasksToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("content_tasks")
        .delete()
        .in(
          "id",
          tasksToDelete.map((t) => t.id),
        );

      if (deleteError) {
        console.error("❌ Error deleting duplicate tasks:", deleteError);
      } else {
      }
    } else {
    }
  } catch (error) {
    console.error("❌ Error in fallback cleanup:", error);
  }
};
