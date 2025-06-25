
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentWeekNumber } from '@/utils/dateUtils';
import { cleanupDuplicateCampaigns, generateMeaningfulTheme } from '@/utils/campaignCleanup';

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

        // First, cleanup any duplicate campaigns for this week
        const cleanupResult = await cleanupDuplicateCampaigns(user.id, currentWeek);
        if (cleanupResult.success && cleanupResult.bestCampaign) {
          console.log('✅ Found existing good campaign:', cleanupResult.bestCampaign.theme);
          return; // Don't auto-generate content - let user decide
        }

        // Check if current week campaign exists
        const { data: existingCampaign, error: campaignError } = await supabase
          .from('campaigns')
          .select('id, title, theme, week_number, description')
          .eq('user_id', user.id)
          .eq('tenant_id', tenant.id)
          .eq('week_number', currentWeek)
          .not('theme', 'ilike', '%seasonal gardening focus%')
          .not('theme', 'ilike', '%week % seasonal content%')
          .maybeSingle();

        if (campaignError) {
          console.error('❌ Error checking existing campaign:', campaignError);
          return;
        }

        // Create campaign if it doesn't exist
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
            tenant_id: tenant.id,
            source: 'auto_generated_meaningful'
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
          // Note: No automatic content generation - user will trigger it manually
        }

      } catch (error) {
        console.error('❌ WeeklyContentUpdater error:', error);
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
