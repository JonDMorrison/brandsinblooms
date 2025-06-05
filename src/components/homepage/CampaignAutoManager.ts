
import { getCurrentWeekCampaign, getTasksForCampaign } from "./homepageUtils";
import { cleanupDuplicatesForCampaign, updateVideoTasksWithNewScript, createMissingTasks, generateRequiredTasks } from "./TaskManagementUtils";
import { supabase } from "@/integrations/supabase/client";
import { generateThemeDescription } from "../calendar/ThemeDescriptionGenerator";

export const useAutoCampaignManager = (campaigns: any[], tasks: any[], onTaskUpdate?: () => void) => {
  const autoCreateCurrentWeekCampaign = async () => {
    console.log('Auto-create effect running with campaigns:', campaigns.length);
    let currentCampaign = getCurrentWeekCampaign(campaigns);
    console.log('Current campaign found:', currentCampaign);
    
    // If we have a campaign, check if it needs content generation
    if (currentCampaign) {
      // Check if campaign needs theme and description
      if (currentCampaign.title && (!currentCampaign.theme || !currentCampaign.description)) {
        console.log('Campaign missing theme or description, generating...');
        
        let themeDescription = "";
        if (currentCampaign.title) {
          try {
            await new Promise<void>((resolve) => {
              generateThemeDescription(
                currentCampaign.title,
                (description) => {
                  themeDescription = description;
                  resolve();
                },
                () => {} // onLoadingChange - not needed here
              );
            });
          } catch (error) {
            console.error('Error generating theme description:', error);
            // Use fallback description if generation fails
            themeDescription = `This week's content will focus on promoting ${currentCampaign.title.toLowerCase()} and helping customers understand the value and benefits. All materials will emphasize practical information, seasonal timing, and how our garden center can support their gardening goals.`;
          }
        }

        // Update campaign with theme and description
        try {
          const { error } = await supabase
            .from('campaigns')
            .update({ 
              theme: currentCampaign.title,
              description: themeDescription
            })
            .eq('id', currentCampaign.id);

          if (error) {
            console.error('Error updating campaign theme:', error);
          } else {
            console.log('Campaign theme and description updated');
            // Update local campaign object
            currentCampaign.theme = currentCampaign.title;
            currentCampaign.description = themeDescription;
          }
        } catch (error) {
          console.error('Error updating campaign theme:', error);
        }
      }

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
