
import { supabase } from "@/integrations/supabase/client";

export const ensureCampaignHasTasks = async (
  campaigns: any[], 
  userId?: string,
  onTaskUpdate?: () => void
) => {
  if (!campaigns.length) return;

  try {
    // Get the current week's campaign
    const currentDate = new Date();
    const currentWeekNumber = Math.ceil(
      ((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
    );
    
    const currentCampaign = campaigns.find(c => c.week_number === currentWeekNumber) || campaigns[0];
    
    if (!currentCampaign) return;

    // Check if this campaign has tasks
    const { data: existingTasks, error } = await supabase
      .from('content_tasks')
      .select('id, post_type')
      .eq('campaign_id', currentCampaign.id);

    if (error) {
      console.error('Error checking existing tasks:', error);
      return;
    }

    // Log the current state but don't auto-generate
    if (!existingTasks || existingTasks.length === 0) {
      console.log('No tasks found for current campaign. User can generate them manually.');
    } else {
      console.log(`Campaign ${currentCampaign.title} already has ${existingTasks.length} tasks`);
    }
  } catch (error) {
    console.error('Error in ensureCampaignHasTasks:', error);
  }
};
