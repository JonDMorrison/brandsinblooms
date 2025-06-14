import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

export const WeeklyContentUpdater = () => {
  const { user } = useAuth();
  const currentWeekNumber = getCurrentWeekNumber();

  useEffect(() => {
    const updateWeeklyContent = async () => {
      if (!user) return;

      try {
        console.log('WeeklyContentUpdater: Checking for week', currentWeekNumber, 'user:', user.id);

        // Check if there are any campaigns for the current week for this user
        const { data: existingCampaigns, error: checkError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('week_number', currentWeekNumber)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (checkError) {
          console.error('WeeklyContentUpdater: Error checking existing campaigns:', checkError);
          return;
        }

        console.log('WeeklyContentUpdater: Found existing campaigns:', existingCampaigns?.length || 0);

        // Enhanced cleanup logic for duplicates
        if (existingCampaigns && existingCampaigns.length > 1) {
          console.log('WeeklyContentUpdater: Found multiple campaigns, analyzing for cleanup...');
          
          // Check content for each campaign
          const campaignsWithContent = await Promise.all(
            existingCampaigns.map(async (campaign) => {
              const { data: tasks } = await supabase
                .from('content_tasks')
                .select('id, ai_output')
                .eq('campaign_id', campaign.id);

              const hasContent = tasks?.some(task => task.ai_output && task.ai_output.trim() !== '') || false;
              const taskCount = tasks?.length || 0;

              return {
                campaign,
                hasContent,
                taskCount
              };
            })
          );

          // Find campaigns to delete (empty ones when there are campaigns with content)
          const campaignsWithActualContent = campaignsWithContent.filter(c => c.hasContent);
          const emptyCampaigns = campaignsWithContent.filter(c => !c.hasContent);

          // If we have campaigns with content, delete the empty ones
          if (campaignsWithActualContent.length > 0 && emptyCampaigns.length > 0) {
            console.log('WeeklyContentUpdater: Deleting', emptyCampaigns.length, 'empty campaigns');
            
            for (const { campaign } of emptyCampaigns) {
              try {
                console.log('WeeklyContentUpdater: Deleting empty campaign:', campaign.title, campaign.id);
                
                // Delete associated tasks first
                await supabase
                  .from('content_tasks')
                  .delete()
                  .eq('campaign_id', campaign.id);
                
                // Then delete the campaign
                await supabase
                  .from('campaigns')
                  .delete()
                  .eq('id', campaign.id);
                
                console.log('WeeklyContentUpdater: Successfully deleted empty campaign:', campaign.title);
              } catch (error) {
                console.error('WeeklyContentUpdater: Error deleting empty campaign', campaign.id, ':', error);
              }
            }
          }
          // If all campaigns are empty, keep the most recent one and delete the rest
          else if (campaignsWithActualContent.length === 0 && emptyCampaigns.length > 1) {
            const campaignsToDelete = emptyCampaigns.slice(1); // Keep first (most recent), delete rest
            
            console.log('WeeklyContentUpdater: All campaigns are empty, keeping most recent, deleting', campaignsToDelete.length);
            
            for (const { campaign } of campaignsToDelete) {
              try {
                await supabase.from('content_tasks').delete().eq('campaign_id', campaign.id);
                await supabase.from('campaigns').delete().eq('id', campaign.id);
                console.log('WeeklyContentUpdater: Deleted duplicate empty campaign:', campaign.title);
              } catch (error) {
                console.error('WeeklyContentUpdater: Error deleting duplicate campaign:', error);
              }
            }
          }
          // If we have multiple campaigns with content, keep the one with most content
          else if (campaignsWithActualContent.length > 1) {
            console.log('WeeklyContentUpdater: Multiple campaigns with content, keeping the best one');
            
            // Sort by content amount, then by creation date
            campaignsWithActualContent.sort((a, b) => {
              if (a.taskCount !== b.taskCount) return b.taskCount - a.taskCount;
              return new Date(b.campaign.created_at || '').getTime() - new Date(a.campaign.created_at || '').getTime();
            });

            const campaignsToDelete = campaignsWithActualContent.slice(1);
            
            for (const { campaign } of campaignsToDelete) {
              try {
                await supabase.from('content_tasks').delete().eq('campaign_id', campaign.id);
                await supabase.from('campaigns').delete().eq('id', campaign.id);
                console.log('WeeklyContentUpdater: Deleted redundant campaign with content:', campaign.title);
              } catch (error) {
                console.error('WeeklyContentUpdater: Error deleting redundant campaign:', error);
              }
            }
          }
        }

        // Re-check after cleanup
        const { data: finalCampaigns } = await supabase
          .from('campaigns')
          .select('*')
          .eq('week_number', currentWeekNumber)
          .eq('user_id', user.id);

        // If no campaigns exist for current week, create one
        if (!finalCampaigns || finalCampaigns.length === 0) {
          console.log('WeeklyContentUpdater: No campaign found for week', currentWeekNumber, ', creating one');
          
          // Generate a theme for the current week
          const { data: themeData, error: themeError } = await supabase.functions.invoke('generate-weekly-themes', {
            body: { 
              userId: user.id, 
              weekNumber: currentWeekNumber 
            }
          });

          if (themeError) {
            console.error('WeeklyContentUpdater: Error generating theme:', themeError);
            return;
          }

          const theme = themeData?.themes?.[0];
          if (!theme) {
            console.error('WeeklyContentUpdater: No theme generated');
            return;
          }

          // Create the campaign
          const { data: newCampaign, error: campaignError } = await supabase
            .from('campaigns')
            .insert({
              week_number: currentWeekNumber,
              title: theme.title,
              description: theme.description,
              theme: theme.title,
              prompt: theme.description,
              start_date: new Date().toISOString().split('T')[0],
              user_id: user.id,
              source: 'auto_generated'
            })
            .select()
            .single();

          if (campaignError) {
            console.error('WeeklyContentUpdater: Error creating campaign:', campaignError);
            return;
          }

          console.log('WeeklyContentUpdater: Created new campaign:', newCampaign.title);
        } else {
          console.log('WeeklyContentUpdater: Campaign exists for week', currentWeekNumber, '- campaign:', finalCampaigns[0].title);
        }

      } catch (error) {
        console.error('WeeklyContentUpdater: Unexpected error:', error);
      }
    };

    updateWeeklyContent();
  }, [user, currentWeekNumber]);

  return null; // This component doesn't render anything
};
