
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentWeekNumber } from './homepageUtils';
import { generateRequiredTasks } from './TaskManagementUtils';
import { generateThemeDescription } from '../calendar/ThemeDescriptionGenerator';

export const useAutoCampaignManager = (campaigns: any[], tasks: any[], onTaskUpdate?: () => void) => {
  const autoCreateCurrentWeekCampaign = useCallback(async () => {
    console.log('AutoCampaignManager: Starting auto-create check');
    
    const currentWeek = getCurrentWeekNumber();
    const currentYear = new Date().getFullYear();
    
    // Check if there's already a campaign for the current week
    const existingCampaign = campaigns.find(campaign => 
      campaign.week_number === currentWeek && 
      new Date(campaign.start_date).getFullYear() === currentYear
    );
    
    if (existingCampaign) {
      console.log('AutoCampaignManager: Found existing campaign:', existingCampaign.title);
      
      // Check if the existing campaign needs a description
      if (existingCampaign.theme && !existingCampaign.description) {
        console.log('AutoCampaignManager: Generating description for existing campaign');
        try {
          await new Promise<void>((resolve) => {
            generateThemeDescription(
              existingCampaign.theme,
              async (description) => {
                const { error } = await supabase
                  .from('campaigns')
                  .update({ description })
                  .eq('id', existingCampaign.id);
                
                if (error) {
                  console.error('Error updating campaign description:', error);
                } else {
                  console.log('Campaign description updated successfully');
                  if (onTaskUpdate) onTaskUpdate();
                }
                resolve();
              },
              () => {} // onLoadingChange - not needed here
            );
          });
        } catch (error) {
          console.error('Error generating description:', error);
        }
      }
      
      // Check if tasks need to be created
      const campaignTasks = tasks.filter(task => task.campaign_id === existingCampaign.id);
      const requiredTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
      const missingTypes = requiredTypes.filter(type => 
        !campaignTasks.some(task => task.post_type === type)
      );
      
      if (missingTypes.length > 0) {
        console.log('AutoCampaignManager: Generating missing tasks for existing campaign:', missingTypes);
        await generateRequiredTasks(existingCampaign.id, existingCampaign.title, currentWeek, missingTypes);
        if (onTaskUpdate) onTaskUpdate();
      }
      
      return;
    }
    
    console.log('AutoCampaignManager: No campaign found for current week, creating one');
    
    // Create a new campaign for the current week
    const today = new Date();
    const mondayOfCurrentWeek = new Date(today);
    mondayOfCurrentWeek.setDate(today.getDate() - today.getDay() + 1);
    
    const campaignTitle = `Week ${currentWeek} Campaign`;
    const theme = `Weekly Garden Center Promotion - Week ${currentWeek}`;
    
    // Generate description for the new campaign
    let description = "";
    try {
      await new Promise<void>((resolve) => {
        generateThemeDescription(
          theme,
          (generatedDescription) => {
            description = generatedDescription;
            resolve();
          },
          () => {} // onLoadingChange - not needed here
        );
      });
    } catch (error) {
      console.error('Error generating description:', error);
      description = `This week's content will focus on promoting our weekly garden center activities and helping customers understand the value and benefits. All materials will emphasize practical information, seasonal timing, and how our garden center can support their gardening goals.`;
    }
    
    try {
      const { data: newCampaign, error } = await supabase
        .from('campaigns')
        .insert({
          title: campaignTitle,
          week_number: currentWeek,
          start_date: mondayOfCurrentWeek.toISOString().split('T')[0],
          theme,
          description
        })
        .select()
        .single();
      
      if (error) {
        console.error('AutoCampaignManager: Error creating campaign:', error);
        return;
      }
      
      console.log('AutoCampaignManager: Created new campaign:', newCampaign.title);
      
      // Generate required tasks for the new campaign
      const requiredTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
      await generateRequiredTasks(newCampaign.id, newCampaign.title, currentWeek, requiredTypes);
      
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('AutoCampaignManager: Error in campaign creation:', error);
    }
  }, [campaigns, tasks, onTaskUpdate]);
  
  return {
    autoCreateCurrentWeekCampaign
  };
};
