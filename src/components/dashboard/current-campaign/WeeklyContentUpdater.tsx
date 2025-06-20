
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
        console.log('WeeklyContentUpdater: Starting for user:', user.id, 'tenant:', tenant?.id || 'none', 'week:', currentWeekNumber);

        // 🔧 STEP 1: CLEAN UP DUPLICATE CAMPAIGNS FIRST
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
          toast.error('Failed to check existing campaigns');
          return;
        }

        console.log('WeeklyContentUpdater: Found campaigns for current week:', existingCampaigns?.length || 0);

        // 🔧 AGGRESSIVE CLEANUP: Delete all duplicate empty campaigns
        if (existingCampaigns && existingCampaigns.length > 1) {
          console.log('WeeklyContentUpdater: Found', existingCampaigns.length, 'campaigns - cleaning up duplicates');
          
          // Check content for each campaign
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
              
              console.log(`WeeklyContentUpdater: Campaign "${campaign.title}" (${campaign.id}) has ${tasks?.length || 0} tasks, hasRealContent: ${hasRealContent}`);
              
              return {
                campaign,
                hasRealContent,
                taskCount: tasks?.length || 0,
                tasks: tasks || []
              };
            })
          );

          // Find the best campaign to keep
          const campaignsWithRealContent = campaignsWithContent.filter(c => c.hasRealContent);
          
          let campaignToKeep;
          let campaignsToDelete = [];

          if (campaignsWithRealContent.length > 0) {
            // Keep the one with most content
            campaignToKeep = campaignsWithRealContent.sort((a, b) => b.taskCount - a.taskCount)[0];
            campaignsToDelete = campaignsWithContent.filter(c => c.campaign.id !== campaignToKeep.campaign.id);
          } else {
            // All campaigns are empty, keep the newest one and delete the rest
            campaignToKeep = campaignsWithContent[0]; // Most recent due to ordering
            campaignsToDelete = campaignsWithContent.slice(1);
          }

          console.log(`WeeklyContentUpdater: Keeping campaign "${campaignToKeep.campaign.title}", deleting ${campaignsToDelete.length} duplicates`);

          // Delete duplicate campaigns and their tasks
          for (const { campaign } of campaignsToDelete) {
            try {
              console.log(`WeeklyContentUpdater: Deleting duplicate campaign: ${campaign.title} (${campaign.id})`);
              
              // Delete tasks first
              await supabase
                .from('content_tasks')
                .delete()
                .eq('campaign_id', campaign.id);
              
              // Delete the campaign
              await supabase
                .from('campaigns')
                .delete()
                .eq('id', campaign.id);
                
              console.log(`WeeklyContentUpdater: Successfully deleted duplicate: ${campaign.title}`);
            } catch (error) {
              console.error(`WeeklyContentUpdater: Error deleting campaign ${campaign.id}:`, error);
            }
          }
        }

        // 🔧 STEP 2: GET THE REMAINING CAMPAIGN
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

        // 🔧 STEP 3: CREATE CAMPAIGN IF NONE EXISTS
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
              toast.error('Failed to generate weekly theme');
              return;
            }

            const theme = themeData?.themes?.[0];
            if (!theme) {
              console.error('WeeklyContentUpdater: No theme generated');
              toast.error('No theme could be generated');
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
              toast.error('Failed to create weekly campaign');
              return;
            }

            console.log('WeeklyContentUpdater: Created new campaign:', newCampaign.title);
            targetCampaign = newCampaign;
          } catch (error) {
            console.error('WeeklyContentUpdater: Error in campaign creation:', error);
            toast.error('Failed to create weekly campaign');
            return;
          }
        }

        // 🔧 STEP 4: ENHANCED CONTENT GENERATION FOR CAMPAIGNS WITHOUT CONTENT
        if (targetCampaign) {
          console.log(`WeeklyContentUpdater: Checking content for campaign: ${targetCampaign.title} (${targetCampaign.id})`);
          
          const { data: existingTasks } = await supabase
            .from('content_tasks')
            .select('id, ai_output, status, post_type')
            .eq('campaign_id', targetCampaign.id);

          console.log(`WeeklyContentUpdater: Found ${existingTasks?.length || 0} existing tasks:`, 
            existingTasks?.map(t => `${t.post_type}(${t.status})`) || []);

          const hasRealContent = existingTasks?.some(task => 
            task.ai_output && 
            task.ai_output.trim() !== '' && 
            task.status !== 'generating'
          );

          const hasStuckTasks = existingTasks?.some(task => task.status === 'generating');
          const hasNoTasks = !existingTasks || existingTasks.length === 0;

          console.log(`WeeklyContentUpdater: Content analysis - hasRealContent: ${hasRealContent}, hasStuckTasks: ${hasStuckTasks}, hasNoTasks: ${hasNoTasks}`);

          // Force content generation if: no real content, stuck tasks, or no tasks at all
          if (!hasRealContent || hasStuckTasks || hasNoTasks) {
            console.log('WeeklyContentUpdater: FORCING content generation for campaign:', targetCampaign.title);
            
            try {
              // Delete any stuck generating tasks first
              if (hasStuckTasks) {
                console.log('WeeklyContentUpdater: Deleting stuck generating tasks');
                await supabase
                  .from('content_tasks')
                  .delete()
                  .eq('campaign_id', targetCampaign.id)
                  .eq('status', 'generating');
              }

              // Show progress toast
              toast.loading('Generating your weekly content...', { id: 'content-generation' });

              // Generate fresh content with enhanced error handling
              const result = await generateCampaignContent(
                targetCampaign.id,
                targetCampaign.theme || targetCampaign.title,
                targetCampaign.description || '',
                user.id,
                targetCampaign.week_number,
                tenant?.id
              );
              
              if (result.success) {
                console.log('WeeklyContentUpdater: ✅ Successfully generated content! Tasks created:', result.tasks?.length || 0);
                
                // Log the task details
                if (result.tasks) {
                  result.tasks.forEach(task => {
                    console.log(`WeeklyContentUpdater: Created ${task.post_type} task (${task.id}) with ${task.ai_output?.length || 0} chars`);
                  });
                }
                
                // Success toast
                toast.success(`Generated ${result.tasks?.length || 0} content pieces for review!`, { id: 'content-generation' });
              } else {
                console.error('WeeklyContentUpdater: ❌ Content generation failed:', result.message);
                toast.error(`Content generation failed: ${result.message}`, { id: 'content-generation' });
              }
            } catch (error) {
              console.error('WeeklyContentUpdater: ❌ Error during content generation:', error);
              
              // Enhanced error logging
              if (error instanceof Error) {
                console.error('WeeklyContentUpdater: Error details:', {
                  name: error.name,
                  message: error.message,
                  stack: error.stack
                });
              }
              
              // Error toast
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              toast.error(`Content generation failed: ${errorMessage}`, { id: 'content-generation' });
            }
          } else {
            console.log('WeeklyContentUpdater: ✅ Campaign already has sufficient content, skipping generation');
          }
        }

      } catch (error) {
        console.error('WeeklyContentUpdater: ❌ Unexpected error:', error);
        
        // Enhanced error logging for debugging
        if (error instanceof Error) {
          console.error('WeeklyContentUpdater: Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
        }
        
        // Show user-friendly error
        toast.error('Failed to update weekly content. Please try refreshing the page.');
      }
    };

    // Run the update with a small delay to ensure everything is initialized
    const timeoutId = setTimeout(updateWeeklyContent, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [user, tenant, tenantLoading, currentWeekNumber]);

  return null; // This component doesn't render anything
};
