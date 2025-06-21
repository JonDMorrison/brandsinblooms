
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";
import { toast } from "sonner";

export const WeeklyContentUpdater = () => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const currentWeekNumber = getCurrentWeekNumber();

  useEffect(() => {
    const updateWeeklyContent = async () => {
      if (!user) {
        console.log('WeeklyContentUpdater: No user available, skipping update');
        return;
      }

      if (tenantLoading) {
        console.log('WeeklyContentUpdater: Tenant still loading, waiting...');
        return;
      }

      try {
        console.log('WeeklyContentUpdater: Starting for user:', user.id, 'tenant:', tenant?.id || 'none', 'week:', currentWeekNumber);

        // Check for existing campaign - don't be aggressive
        let campaignQuery = supabase
          .from('campaigns')
          .select('*')
          .eq('week_number', currentWeekNumber)
          .order('created_at', { ascending: false });

        if (tenant?.id) {
          campaignQuery = campaignQuery.eq('tenant_id', tenant.id);
        } else {
          campaignQuery = campaignQuery.eq('user_id', user.id);
        }

        const { data: existingCampaigns, error: checkError } = await campaignQuery;

        if (checkError) {
          console.error('WeeklyContentUpdater: Error checking existing campaigns:', checkError);
          return;
        }

        console.log('WeeklyContentUpdater: Found campaigns for current week:', existingCampaigns?.length || 0);

        // Only clean up if we have multiple empty campaigns
        if (existingCampaigns && existingCampaigns.length > 1) {
          console.log('WeeklyContentUpdater: Multiple campaigns found - checking for empty duplicates');
          
          const campaignsWithContent = await Promise.all(
            existingCampaigns.map(async (campaign) => {
              const { data: tasks } = await supabase
                .from('content_tasks')
                .select('id, ai_output, status')
                .eq('campaign_id', campaign.id);

              const hasRealContent = tasks?.some(task => 
                task.ai_output && 
                task.ai_output.trim() !== '' && 
                task.status !== 'generating'
              ) || false;
              
              return {
                campaign,
                hasRealContent,
                taskCount: tasks?.length || 0
              };
            })
          );

          // Only delete campaigns that are truly empty
          const emptyCampaigns = campaignsWithContent.filter(c => !c.hasRealContent && c.taskCount === 0);
          
          if (emptyCampaigns.length > 0) {
            console.log(`WeeklyContentUpdater: Deleting ${emptyCampaigns.length} empty campaigns`);
            
            for (const { campaign } of emptyCampaigns.slice(1)) { // Keep at least one
              try {
                await supabase
                  .from('campaigns')
                  .delete()
                  .eq('id', campaign.id);
                console.log(`WeeklyContentUpdater: Deleted empty campaign: ${campaign.title}`);
              } catch (error) {
                console.error(`WeeklyContentUpdater: Error deleting campaign ${campaign.id}:`, error);
              }
            }
          }
        }

        // Get the remaining campaign
        let finalQuery = supabase
          .from('campaigns')
          .select('*')
          .eq('week_number', currentWeekNumber);

        if (tenant?.id) {
          finalQuery = finalQuery.eq('tenant_id', tenant.id);
        } else {
          finalQuery = finalQuery.eq('user_id', user.id);
        }

        const { data: finalCampaigns } = await finalQuery;
        let targetCampaign = finalCampaigns?.[0];

        // Create campaign only if none exists
        if (!targetCampaign) {
          console.log('WeeklyContentUpdater: No campaign found, creating one for week', currentWeekNumber);
          
          try {
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

            const campaignData: any = {
              week_number: currentWeekNumber,
              title: theme.title,
              description: theme.description,
              theme: theme.title,
              prompt: theme.description,
              start_date: new Date().toISOString().split('T')[0],
              source: 'auto_generated'
            };

            if (tenant?.id) {
              campaignData.tenant_id = tenant.id;
              campaignData.created_by_user_id = user.id;
            } else {
              campaignData.user_id = user.id;
            }

            const { data: newCampaign, error: campaignError } = await supabase
              .from('campaigns')
              .insert(campaignData)
              .select()
              .single();

            if (campaignError) {
              console.error('WeeklyContentUpdater: Error creating campaign:', campaignError);
              return;
            }

            console.log('WeeklyContentUpdater: Created new campaign:', newCampaign.title);
            targetCampaign = newCampaign;
          } catch (error) {
            console.error('WeeklyContentUpdater: Error in campaign creation:', error);
            return;
          }
        }

        // Check existing content - RESPECT what's already there
        if (targetCampaign) {
          console.log(`WeeklyContentUpdater: Checking existing content for campaign: ${targetCampaign.title}`);
          
          const { data: existingTasks } = await supabase
            .from('content_tasks')
            .select('id, ai_output, status, post_type')
            .eq('campaign_id', targetCampaign.id);

          console.log(`WeeklyContentUpdater: Found ${existingTasks?.length || 0} existing tasks`);

          const hasAnyContent = existingTasks?.some(task => 
            task.ai_output && 
            task.ai_output.trim() !== ''
          );

          const hasStuckTasks = existingTasks?.some(task => task.status === 'generating');

          // Only generate if there's truly no content OR there are stuck tasks
          if ((!hasAnyContent && existingTasks?.length === 0) || hasStuckTasks) {
            console.log('WeeklyContentUpdater: No existing content found - generating initial content');
            
            try {
              // Clean up stuck tasks only
              if (hasStuckTasks) {
                console.log('WeeklyContentUpdater: Cleaning up stuck generating tasks');
                await supabase
                  .from('content_tasks')
                  .delete()
                  .eq('campaign_id', targetCampaign.id)
                  .eq('status', 'generating');
              }

              const result = await generateCampaignContent(
                targetCampaign.id,
                targetCampaign.theme || targetCampaign.title,
                targetCampaign.description || '',
                user.id,
                targetCampaign.week_number,
                tenant?.id
              );
              
              if (result.success) {
                console.log('WeeklyContentUpdater: ✅ Initial content generated successfully');
              } else {
                console.error('WeeklyContentUpdater: ❌ Content generation failed:', result.message);
              }
            } catch (error) {
              console.error('WeeklyContentUpdater: ❌ Error during content generation:', error);
            }
          } else {
            console.log('WeeklyContentUpdater: ✅ Campaign already has content - preserving existing content');
          }
        }

      } catch (error) {
        console.error('WeeklyContentUpdater: ❌ Unexpected error:', error);
      }
    };

    // Run the update with a delay to ensure initialization
    const timeoutId = setTimeout(updateWeeklyContent, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [user, tenant, tenantLoading, currentWeekNumber]);

  return null;
};
