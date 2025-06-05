
import { getCurrentWeekCampaign, getTasksForCampaign } from "./homepageUtils";
import { cleanupDuplicatesForCampaign, updateVideoTasksWithNewScript, createMissingTasks, generateRequiredTasks } from "./TaskManagementUtils";

export const useAutoCampaignManager = (campaigns: any[], tasks: any[], onTaskUpdate?: () => void) => {
  const autoCreateCurrentWeekCampaign = async () => {
    console.log('Auto-create effect running with campaigns:', campaigns.length);
    let currentCampaign = getCurrentWeekCampaign(campaigns);
    console.log('Current campaign found:', currentCampaign);
    
    // If we have a campaign, check if it needs content generation
    if (currentCampaign) {
      // First clean up any existing duplicates
      await cleanupDuplicatesForCampaign(currentCampaign.id);
      
      // Update video task with new script
      await updateVideoTasksWithNewScript(currentCampaign.id, currentCampaign.title);
      
      // Then check if we need to generate tasks
      const campaignTasks = getTasksForCampaign(tasks, currentCampaign.id);
      console.log('Campaign tasks found:', campaignTasks.length);
      
      if (campaignTasks.length === 0) {
        console.log('No tasks found, generating required tasks...');
        await generateRequiredTasks(currentCampaign.id.toString(), campaigns, onTaskUpdate);
      } else {
        // Check for missing required task types
        const requiredTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
        const existingTypes = campaignTasks.map(task => task.post_type);
        const missingTypes = requiredTypes.filter(type => !existingTypes.includes(type));
        
        if (missingTypes.length > 0) {
          console.log('Creating missing task types:', missingTypes);
          await createMissingTasks(currentCampaign.id.toString(), missingTypes, currentCampaign.title);
          if (onTaskUpdate) onTaskUpdate();
        }
      }
    }
  };

  return { autoCreateCurrentWeekCampaign };
};
