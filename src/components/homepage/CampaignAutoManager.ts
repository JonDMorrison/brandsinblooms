import { supabase } from "@/integrations/supabase/client";
import { cleanupDuplicatesForCampaign } from "./TaskManagementUtils";

export const ensureCampaignHasTasks = async (
  campaigns: any[],
  userId?: string,
  onTaskUpdate?: () => void,
) => {
  if (!campaigns.length) return;

  try {
    // Get the current week's campaign
    const currentDate = new Date();
    const currentWeekNumber = Math.ceil(
      ((currentDate.getTime() -
        new Date(currentDate.getFullYear(), 0, 1).getTime()) /
        86400000 +
        1) /
        7,
    );

    const currentCampaign =
      campaigns.find((c) => c.week_number === currentWeekNumber) ||
      campaigns[0];

    if (!currentCampaign) return;

    // Check if this campaign has tasks
    const { data: existingTasks, error } = await supabase
      .from("content_tasks")
      .select("id, post_type")
      .eq("campaign_id", currentCampaign.id);

    if (error) {
      console.error("Error checking existing tasks:", error);
      return;
    }

    // Clean up any duplicates that might exist
    if (existingTasks && existingTasks.length > 0) {
      await cleanupDuplicatesForCampaign(currentCampaign.id);
    }

    // Log the current state but don't auto-generate
    if (!existingTasks || existingTasks.length === 0) {
    } else {
      // Check for duplicates and log
      const uniqueTypes = new Set(existingTasks.map((t) => t.post_type));
      const expectedTypes = 5; // newsletter, instagram, facebook, email, video

      if (existingTasks.length > expectedTypes) {
      } else if (uniqueTypes.size !== expectedTypes) {
      } else {
      }
    }
  } catch (error) {
    console.error("Error in ensureCampaignHasTasks:", error);
  }
};
