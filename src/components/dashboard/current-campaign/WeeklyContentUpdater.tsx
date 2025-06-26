
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentWeekNumber } from '@/utils/dateUtils';
import { cleanupDuplicateCampaigns, generateMeaningfulTheme } from '@/utils/campaignCleanup';
import { generateCampaignContent } from '@/components/homepage/ContentGenerationServices';
import { toast } from 'sonner';

export const WeeklyContentUpdater = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const isProcessingRef = useRef(false);
  const lastRunTimestampRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !mountedRef.current) return;

    const ensureCurrentWeekCampaignWithContent = async () => {
      // Rate limiting: prevent runs within 10 seconds of each other
      const now = Date.now();
      if (now - lastRunTimestampRef.current < 10000) {
        return;
      }
      
      // Prevent concurrent runs
      if (isProcessingRef.current) {
        return;
      }
      
      try {
        isProcessingRef.current = true;
        lastRunTimestampRef.current = now;
        
        const currentWeek = getCurrentWeekNumber();
        
        console.log('🔍 WeeklyContentUpdater: Starting check for week:', currentWeek);

        // First, cleanup any duplicate campaigns for this week
        const cleanupResult = await cleanupDuplicateCampaigns(user.id, currentWeek);
        if (cleanupResult.success && cleanupResult.bestCampaign) {
          console.log('✅ Found existing campaign:', cleanupResult.bestCampaign.theme);
          
          // Check if this campaign has content already
          const { data: existingTasks } = await supabase
            .from('content_tasks')
            .select('id')
            .eq('campaign_id', cleanupResult.bestCampaign.id)
            .eq('user_id', user.id);

          if (existingTasks && existingTasks.length > 0) {
            console.log('✅ Campaign already has content, setup complete');
            return;
          }

          // Campaign exists but no content - generate it for new users
          console.log('📝 Campaign exists but no content found, generating...');
          await generateContentForCampaign(cleanupResult.bestCampaign);
          return;
        }

        // Build query based on tenant availability  
        let campaignQuery = supabase
          .from('campaigns')
          .select('id, title, theme, week_number, description')
          .eq('user_id', user.id)
          .eq('week_number', currentWeek)
          .not('theme', 'ilike', '%seasonal gardening focus%')
          .not('theme', 'ilike', '%week % seasonal content%');

        // Only add tenant_id filter if tenant exists
        if (tenant?.id) {
          campaignQuery = campaignQuery.eq('tenant_id', tenant.id);
        }

        const { data: existingCampaign, error: campaignError } = await campaignQuery.maybeSingle();

        if (campaignError) {
          console.error('❌ Error checking existing campaign:', campaignError);
          return;
        }

        // Create campaign if it doesn't exist, then generate content
        if (!existingCampaign) {
          console.log('📝 Creating meaningful campaign for current week:', currentWeek);
          
          // Get company profile for personalization
          const { data: companyProfile } = await supabase
            .from('company_profiles')
            .select('company_name')
            .eq('user_id', user.id)
            .single();

          // Generate meaningful theme
          const themeData = await generateMeaningfulTheme(
            currentWeek, 
            companyProfile?.company_name
          );

          const campaignData = {
            week_number: currentWeek,
            title: themeData.title,
            theme: themeData.theme,
            description: themeData.description,
            start_date: new Date().toISOString().split('T')[0],
            prompt: `Create engaging gardening content focused on ${themeData.theme}`,
            user_id: user.id,
            source: 'auto_generated_meaningful',
            ...(tenant?.id && { tenant_id: tenant.id }) // Only set tenant_id if tenant exists
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

          console.log('✅ Created meaningful campaign:', newCampaign.theme);
          
          // Generate content for the new campaign  
          await generateContentForCampaign(newCampaign);
        } else {
          // Campaign exists, check if it has content
          const { data: existingTasks } = await supabase
            .from('content_tasks')
            .select('id')
            .eq('campaign_id', existingCampaign.id)
            .eq('user_id', user.id);

          if (!existingTasks || existingTasks.length === 0) {
            console.log('📝 Existing campaign has no content, generating...');
            await generateContentForCampaign(existingCampaign);
          }
        }

      } catch (error) {
        console.error('❌ WeeklyContentUpdater error:', error);
      } finally {
        if (mountedRef.current) {
          isProcessingRef.current = false;
        }
      }
    };

    const generateContentForCampaign = async (campaign: any) => {
      if (!mountedRef.current) return;
      
      try {
        console.log('🎯 Auto-generating content for campaign:', campaign.theme);
        
        const toastId = toast.loading('Setting up your weekly content...', { 
          duration: 10000 
        });

        const result = await generateCampaignContent(
          campaign.id,
          campaign.theme || campaign.title,
          campaign.description || '',
          user.id,
          campaign.week_number,
          tenant?.id
        );

        if (result.success && mountedRef.current) {
          console.log('✅ Auto-generated content successfully');
          toast.success('Your weekly content is ready for review!', { 
            id: toastId 
          });
        } else if (mountedRef.current) {
          console.error('❌ Auto-generation failed:', result.message);
          toast.dismiss(toastId);
        }
      } catch (error) {
        console.error('❌ Error auto-generating content:', error);
        if (mountedRef.current) {
          toast.dismiss('auto-setup');
        }
      }
    };

    // Use a timeout to avoid blocking the main thread
    const timeoutId = setTimeout(() => {
      if (mountedRef.current && !isProcessingRef.current) {
        ensureCurrentWeekCampaignWithContent();
      }
    }, 2000);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [user, tenant]); // Removed isProcessing from dependencies to prevent infinite loop

  return null; // This is a background component
};
