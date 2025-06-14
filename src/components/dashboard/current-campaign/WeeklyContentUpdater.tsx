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

        // If there are multiple campaigns for the same week, clean up duplicates (keep the most recent)
        if (existingCampaigns && existingCampaigns.length > 1) {
          console.log('WeeklyContentUpdater: Cleaning up duplicate campaigns');
          const campaignsToDelete = existingCampaigns.slice(1); // Keep the first (most recent), delete the rest
          
          for (const campaign of campaignsToDelete) {
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
          }
          
          console.log('WeeklyContentUpdater: Cleaned up', campaignsToDelete.length, 'duplicate campaigns');
        }

        // If no campaigns exist for current week, create one
        if (!existingCampaigns || existingCampaigns.length === 0) {
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
          console.log('WeeklyContentUpdater: Campaign already exists for week', currentWeekNumber);
        }

      } catch (error) {
        console.error('WeeklyContentUpdater: Unexpected error:', error);
      }
    };

    updateWeeklyContent();
  }, [user, currentWeekNumber]);

  return null; // This component doesn't render anything
};
