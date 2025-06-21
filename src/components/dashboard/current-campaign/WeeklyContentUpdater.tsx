
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

export const WeeklyContentUpdater = () => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const currentWeekNumber = getCurrentWeekNumber();

  useEffect(() => {
    const checkForCampaign = async () => {
      if (!user) {
        console.log('WeeklyContentUpdater: No user available, skipping check');
        return;
      }

      if (tenantLoading) {
        console.log('WeeklyContentUpdater: Tenant still loading, waiting...');
        return;
      }

      try {
        console.log('WeeklyContentUpdater: Checking for existing campaign for user:', user.id, 'tenant:', tenant?.id || 'none', 'week:', currentWeekNumber);

        // Only check if a campaign exists - don't create one automatically
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

        // Only clean up if we have multiple empty campaigns - but don't generate content
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

        // NO AUTOMATIC CAMPAIGN CREATION OR CONTENT GENERATION
        console.log('WeeklyContentUpdater: ✅ Check completed - no automatic actions taken');

      } catch (error) {
        console.error('WeeklyContentUpdater: ❌ Unexpected error:', error);
      }
    };

    // Run the check with a delay to ensure initialization
    const timeoutId = setTimeout(checkForCampaign, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [user, tenant, tenantLoading, currentWeekNumber]);

  return null;
};
