import { supabase } from "@/integrations/supabase/client";

export const cleanupDuplicatesForCampaign = async (campaignId: string) => {
  try {
    // Get the campaign to find its title
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("title, user_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("Error fetching campaign:", campaignError);
      return;
    }

    // Use the comprehensive cleanup function via campaign title
    try {
      const { data: cleanupResult, error: cleanupError } =
        await supabase.functions.invoke("cleanup-duplicate-content", {
          body: { campaign_title: campaign.title },
        });

      if (cleanupError) {
        console.error("❌ Cleanup function error:", cleanupError);
    } catch (error) {
      console.error("❌ Error calling cleanup function:", error);

      // Fallback to local cleanup for this specific campaign
      await fallbackLocalCleanup(campaignId);
    }
  } catch (error) {
    console.error("❌ Error in cleanup process:", error);
  }
};

// Fallback cleanup function for when the edge function is not available
const fallbackLocalCleanup = async (campaignId: string) => {
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
