import { supabase } from "@/integrations/supabase/client";
import {
  generateCampaignContent,
  ContentGenerationResult,
} from "./ContentGenerationServices";
import { useGenerationJobTracker } from "@/state/useGenerationJobTracker";

export const generateRequiredTasks = async (
  campaignId: string,
  campaigns: any[],
  userId: string,
  onTaskUpdate: () => void,
  tenantId?: string,
  jobId?: string,
): Promise<ContentGenerationResult> => {
  try {
    // Find the specific campaign
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      console.error("❌ Campaign not found:", campaignId);
      return {
        success: false,
        message: "Campaign not found",
      };
    }
    // Check if tasks already exist
    const { data: existingTasks, error: checkError } = await supabase
      .from("content_tasks")
      .select("id, post_type, status")
      .eq("campaign_id", campaignId);

    if (checkError) {
      console.error("❌ Error checking existing tasks:", checkError);
      return {
        success: false,
        message: `Failed to check existing tasks: ${checkError.message}`,
      };
    }

    if (existingTasks && existingTasks.length > 0) {
      onTaskUpdate();
      return {
        success: true,
        message: `Found ${existingTasks.length} existing content pieces`,
        tasks: existingTasks,
      };
    }

    // Generate content using the improved service
    const result = await generateCampaignContent(
      campaignId,
      campaign.theme || campaign.title,
      campaign.description || "",
      userId,
      campaign.week_number,
      tenantId,
    );

    if (result.success) {
      onTaskUpdate(); // Refresh the UI
      return result;
    } else {
      console.error("❌ Task generation failed:", result.message);
      return result;
    }
  } catch (error) {
    console.error("❌ RequiredTasksGenerator error:", error);
    return {
      success: false,
      message: error.message || "Task generation failed",
    };
  }
};
