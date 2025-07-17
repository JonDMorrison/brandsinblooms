import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';

interface CRMOnboardingStatus {
  shouldShowOnboarding: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  customerCount: number;
  segmentCount: number;
  campaignCount: number;
  markOnboardingComplete: () => Promise<void>;
}

export const useCRMOnboardingStatus = (): CRMOnboardingStatus => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [customerCount, setCustomerCount] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);

  const checkOnboardingStatus = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);

      // Check if CRM onboarding has been completed
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('crm_onboarding_completed_at')
        .eq('user_id', user.id)
        .single();

      setHasCompletedOnboarding(!!profile?.crm_onboarding_completed_at);

      // Get current counts to determine if onboarding should show
      const [customersResult, segmentsResult, emailCampaignsResult, smsCampaignsResult] = await Promise.all([
        supabase.from('crm_customers').select('id', { count: 'exact' }),
        supabase.from('crm_segments').select('id', { count: 'exact' }),
        supabase.from('crm_campaigns').select('id', { count: 'exact' }),
        supabase.from('crm_sms_campaigns').select('id', { count: 'exact' })
      ]);

      const customers = customersResult.count || 0;
      const segments = segmentsResult.count || 0;
      const emailCampaigns = emailCampaignsResult.count || 0;
      const smsCampaigns = smsCampaignsResult.count || 0;
      const totalCampaigns = emailCampaigns + smsCampaigns;

      setCustomerCount(customers);
      setSegmentCount(segments);
      setCampaignCount(totalCampaigns);

    } catch (error) {
      console.error('Error checking CRM onboarding status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markOnboardingComplete = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('company_profiles')
        .update({ crm_onboarding_completed_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error marking CRM onboarding complete:', error);
    }
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, [user?.id]);

  // Should show onboarding if:
  // - CRM is enabled in subscription
  // - User hasn't completed CRM onboarding
  // - User has no customers imported yet
  const shouldShowOnboarding = 
    !isLoading &&
    subscription?.crm_enabled === true &&
    !hasCompletedOnboarding &&
    customerCount === 0;

  return {
    shouldShowOnboarding,
    isLoading,
    hasCompletedOnboarding,
    customerCount,
    segmentCount,
    campaignCount,
    markOnboardingComplete
  };
};