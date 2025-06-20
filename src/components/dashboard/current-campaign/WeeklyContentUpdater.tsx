
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";

export const WeeklyContentUpdater = () => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const currentWeekNumber = getCurrentWeekNumber();

  useEffect(() => {
    const updateWeeklyContent = async () => {
      // 🔧 HYBRID FIX: Support both tenant and user-based models
      if (!user) {
        console.log('WeeklyContentUpdater: No user available, skipping update');
        return;
      }

      // Don't proceed if tenant is still loading
      if (tenantLoading) {
        console.log('WeeklyContentUpdater: Tenant still loading, waiting...');
        return;
      }

      try {
        console.log('WeeklyContentUpdater: Checking for week', currentWeekNumber, 'user:', user.id, 'tenant:', tenant?.id || 'none');

        // 🔧 HYBRID QUERY: Use tenant_id if available, otherwise user_id
        let campaignQuery = supabase
          .from('campaigns')
          .select('*')
          .eq('week_number', currentWeekNumber)
          .order('created_at', { ascending: false });

        if (tenant?.id) {
          console.log('WeeklyContentUpdater: Using tenant-based query for tenant:', tenant.id);
          campaignQuery = campaignQuery.eq('tenant_id', tenant.id);
        } else {
          console.log('WeeklyContentUpdater: Using user-based query for user:', user.id);
          campaignQuery = campaignQuery.eq('user_id', user.id);
        }

        const { data: existingCampaigns, error: checkError } = await campaignQuery;

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

        // Re-check after cleanup using the same hybrid query
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

        // Check if we have a campaign and if it has content
        let targetCampaign = finalCampaigns?.[0];

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

          // 🔧 HYBRID CREATION: Create campaign with appropriate ownership
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
        }

        // 🔧 CRITICAL FIX: Auto-generate content for campaigns without tasks
        if (targetCampaign) {
          // Check if campaign has content tasks
          const { data: existingTasks } = await supabase
            .from('content_tasks')
            .select('id, ai_output')
            .eq('campaign_id', targetCampaign.id);

          const hasContent = existingTasks?.some(task => task.ai_output && task.ai_output.trim() !== '');

          if (!hasContent) {
            console.log('WeeklyContentUpdater: Campaign has no content, generating automatically...');
            
            try {
              // Use the existing generateCampaignContent function with hybrid support
              await generateCampaignContent(
                targetCampaign.id,
                targetCampaign.theme || targetCampaign.title,
                targetCampaign.description || '',
                user.id,
                targetCampaign.week_number,
                tenant?.id // Pass tenant_id if available, undefined if not
              );
              
              console.log('WeeklyContentUpdater: Successfully generated content for campaign:', targetCampaign.title);
            } catch (error) {
              console.error('WeeklyContentUpdater: Error generating content for campaign:', error);
            }
          } else {
            console.log('WeeklyContentUpdater: Campaign already has content, skipping generation');
          }
        }

      } catch (error) {
        console.error('WeeklyContentUpdater: Unexpected error:', error);
      }
    };

    updateWeeklyContent();
  }, [user, tenant, tenantLoading, currentWeekNumber]);

  return null; // This component doesn't render anything
};
