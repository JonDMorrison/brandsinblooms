
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentWeekNumber } from '@/utils/dateUtils';
import { generateCampaignContent } from '@/components/homepage/ContentGenerationServices';
import { toast } from 'sonner';

export const WeeklyContentUpdater = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!user || !tenant) return;

    const ensureCurrentWeekCampaign = async () => {
      if (isProcessing) return;
      
      try {
        setIsProcessing(true);
        const currentWeek = getCurrentWeekNumber();
        
        console.log('🔍 WeeklyContentUpdater: Checking for current week campaign:', currentWeek);

        // Check if current week campaign exists
        const { data: existingCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .select('id, title, theme, week_number, description')
          .eq('user_id', user.id)
          .eq('tenant_id', tenant.id)
          .eq('week_number', currentWeek)
          .maybeSingle();

        if (campaignError) {
          console.error('❌ Error checking existing campaign:', campaignError);
          return;
        }

        let targetCampaign = existingCampaign;

        // Create campaign if it doesn't exist
        if (!existingCampaign) {
          console.log('📝 Creating campaign for current week:', currentWeek);
          
          const campaignData = {
            week_number: currentWeek,
            title: `Current Week Garden Focus`,
            theme: `Week ${currentWeek} Seasonal Content`,
            description: 'AI-generated weekly content for your garden center',
            start_date: new Date().toISOString().split('T')[0],
            prompt: 'Create engaging seasonal gardening content for current week',
            user_id: user.id,
            tenant_id: tenant.id,
            source: 'auto_generated'
          };

          const { data: newCampaign, error: createError } = await supabase
            .from('campaigns')
            .insert(campaignData)
            .select()
            .single();

          if (createError) {
            console.error('❌ Error creating campaign:', createError);
            return;
          }

          console.log('✅ Created new campaign:', newCampaign.id);
          targetCampaign = newCampaign;
        }

        // Check if campaign has content
        if (targetCampaign) {
          const { data: existingTasks, error: tasksError } = await supabase
            .from('content_tasks')
            .select('id, post_type, status')
            .eq('campaign_id', targetCampaign.id)
            .eq('tenant_id', tenant.id);

          if (tasksError) {
            console.error('❌ Error checking existing tasks:', tasksError);
            return;
          }

          const hasValidContent = existingTasks && existingTasks.length > 0 && 
            existingTasks.some(task => task.status !== 'failed' && task.status !== 'cancelled');

          if (!hasValidContent) {
            console.log('🎨 Generating content for campaign:', targetCampaign.id);
            
            // Show loading toast
            toast.loading('Generating fresh content for this week...', { id: 'weekly-content-gen' });

            const result = await generateCampaignContent(
              targetCampaign.id,
              targetCampaign.theme || targetCampaign.title,
              targetCampaign.description || 'AI-generated weekly content for your garden center',
              user.id,
              targetCampaign.week_number,
              tenant.id
            );

            if (result.success) {
              console.log('🎉 Content generation successful');
              toast.success(`Generated ${result.tasks?.length || 0} content pieces!`, { id: 'weekly-content-gen' });
            } else {
              console.error('❌ Content generation failed:', result.message);
              toast.error(`Content generation failed: ${result.message}`, { id: 'weekly-content-gen' });
            }
          } else {
            console.log('✅ Campaign already has valid content');
          }
        }

      } catch (error) {
        console.error('❌ WeeklyContentUpdater error:', error);
        toast.error('Failed to ensure weekly content');
      } finally {
        setIsProcessing(false);
      }
    };

    // Run the check after a short delay to avoid race conditions
    const timeoutId = setTimeout(ensureCurrentWeekCampaign, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [user, tenant, isProcessing]);

  return null; // This is a background component
};
