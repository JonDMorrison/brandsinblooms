
import { useEffect, useState } from 'react';
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
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const ensureCurrentWeekCampaignWithContent = async () => {
      if (isProcessing) return;
      
      try {
        setIsProcessing(true);
        const currentWeek = getCurrentWeekNumber();
        
        console.log('🔍 WeeklyContentUpdater: Checking for current week campaign and content:', currentWeek);

        // First, cleanup any duplicate campaigns for this week
        const cleanupResult = await cleanupDuplicateCampaigns(user.id, currentWeek);
        if (cleanupResult.success && cleanupResult.bestCampaign) {
          console.log('✅ Found existing good campaign:', cleanupResult.bestCampaign.theme);
          
          // Check if this campaign has content already
          const { data: existingTasks } = await supabase
            .from('content_tasks')
            .select('id')
            .eq('campaign_id', cleanupResult.bestCampaign.id)
            .eq('user_id', user.id);

          if (existingTasks && existingTasks.length > 0) {
            console.log('✅ Campaign already has content, no action needed');
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
        setIsProcessing(false);
      }
    };

    const generateContentForCampaign = async (campaign: any) => {
      try {
        console.log('🎯 Auto-generating content for campaign:', campaign.theme);
        
        // Show a subtle loading toast for new users
        toast.loading('Setting up your weekly content...', { 
          id: 'auto-setup',
          duration: 10000 
        });

        const result = await generateCampaignContent(
          campaign.id,
          campaign.theme || campaign.title,
          campaign.description || '',
          user.id,
          campaign.week_number,
          tenant?.id // Pass tenant_id only if it exists
        );

        if (result.success) {
          console.log('✅ Auto-generated content successfully');
          toast.success('Your weekly content is ready for review!', { 
            id: 'auto-setup' 
          });
        } else {
          console.error('❌ Auto-generation failed:', result.message);
          toast.dismiss('auto-setup');
        }
      } catch (error) {
        console.error('❌ Error auto-generating content:', error);
        toast.dismiss('auto-setup');
      }
    };

    // Run the check after a short delay to avoid race conditions
    const timeoutId = setTimeout(ensureCurrentWeekCampaignWithContent, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [user, tenant, isProcessing]);

  return null; // This is a background component
};
