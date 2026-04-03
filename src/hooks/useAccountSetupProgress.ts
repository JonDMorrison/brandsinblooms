import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  skipped: boolean;
  route?: string;
}

export interface AccountSetupProgress {
  colorsConfirmed: boolean;
  companyProfileComplete: boolean;
  posIntegrated: boolean;
  clientListImported: boolean;
  domainConfigured: boolean;
  socialConnected: boolean;
  googleAnalyticsConnected: boolean;
  smsSetupComplete: boolean;
  firstEmailCampaignSent: boolean;
  firstAutomationCreated: boolean;
  customerSegmentsCreated: boolean;
  newsletterTemplateSent: boolean;
}

const SETUP_PROGRESS_KEY = 'bloomsuite-account-setup-progress';

export const useAccountSetupProgress = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [progress, setProgress] = useState<AccountSetupProgress>({
    colorsConfirmed: false,
    companyProfileComplete: false,
    posIntegrated: false,
    clientListImported: false,
    domainConfigured: false,
    socialConnected: false,
    googleAnalyticsConnected: false,
    smsSetupComplete: false,
    firstEmailCampaignSent: false,
    firstAutomationCreated: false,
    customerSegmentsCreated: false,
    newsletterTemplateSent: false,
  });
  const [skippedSteps, setSkippedSteps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCompletedStep, setLastCompletedStep] = useState<string | null>(null);

  // Load skipped steps from localStorage
  useEffect(() => {
    if (user?.id) {
      const savedSkipped = localStorage.getItem(`${SETUP_PROGRESS_KEY}-skipped-${user.id}`);
      if (savedSkipped) {
        setSkippedSteps(JSON.parse(savedSkipped));
      }
    }
  }, [user?.id]);

  // Check actual completion status from database
  const checkProgress = useCallback(async () => {
    if (!user?.id || !tenant?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Check company profile for colors and basic info
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('brand_primary_color, brand_secondary_color, company_name, company_overview, brand_voice, feature_flags')
        .eq('user_id', user.id)
        .maybeSingle();

      // Check POS connections
      const { data: squareConnection } = await supabase
        .from('square_connections')
        .select('id, setup_wizard_completed_at, merchant_id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      const { data: cloverConnection } = await supabase
        .from('clover_connections')
        .select('id, setup_wizard_completed_at')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      const { data: lightspeedConnection } = await supabase
        .from('lightspeed_connections')
        .select('id, status')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      // Check customer imports
      const { count: customerCount } = await supabase
        .from('crm_customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      // Check email domain setup - consider verified, warming_up, or active as configured
      const { data: emailDomains } = await supabase
        .from('email_domains')
        .select('id, status')
        .eq('tenant_id', tenant.id)
        .in('status', ['verified', 'warming_up', 'active'])
        .limit(1);

      // Check social connections (Facebook or Instagram)
      const { count: socialCount } = await supabase
        .from('social_connections')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

      // Check Google Analytics connection
      const { data: gaConnection } = await supabase
        .from('google_analytics_settings')
        .select('id, connection_status')
        .eq('tenant_id', tenant.id)
        .eq('connection_status', 'connected')
        .limit(1)
        .maybeSingle();

      // Check SMS/Twilio setup via feature_flags
      const smsSetup = profile?.feature_flags as Record<string, unknown> | null;
      const smsComplete = !!(smsSetup && (smsSetup as Record<string, unknown>).sms_setup_completed === true);

      // Check first email campaign sent
      const { count: sentCampaignCount } = await supabase
        .from('crm_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'sent');

      // Check first automation created
      const { count: automationCount } = await supabase
        .from('crm_automations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      // Check customer segments created
      const { count: segmentCount } = await supabase
        .from('crm_segments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id);

      // Check newsletter sent (newsletters are crm_campaigns with type newsletter)
      const { count: newsletterCount } = await supabase
        .from('crm_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('campaign_type', 'newsletter')
        .eq('status', 'sent');

      // Determine completion status
      const colorsConfirmed = !!(profile?.brand_primary_color && profile?.brand_secondary_color);
      const companyProfileComplete = !!(profile?.company_name && profile?.company_overview);
      const posIntegrated = !!(
        (squareConnection?.setup_wizard_completed_at || squareConnection?.merchant_id) ||
        (cloverConnection?.setup_wizard_completed_at || cloverConnection?.id) ||
        (lightspeedConnection?.status === 'connected')
      );
      const clientListImported = (customerCount || 0) > 0;
      const domainConfigured = !!(emailDomains && emailDomains.length > 0);

      setProgress({
        colorsConfirmed,
        companyProfileComplete,
        posIntegrated,
        clientListImported,
        domainConfigured,
        socialConnected: (socialCount || 0) > 0,
        googleAnalyticsConnected: !!gaConnection,
        smsSetupComplete: smsComplete,
        firstEmailCampaignSent: (sentCampaignCount || 0) > 0,
        firstAutomationCreated: (automationCount || 0) > 0,
        customerSegmentsCreated: (segmentCount || 0) > 0,
        newsletterTemplateSent: (newsletterCount || 0) > 0,
      });
    } catch (error) {
      console.error('Error checking setup progress:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, tenant?.id]);

  useEffect(() => {
    checkProgress();
  }, [checkProgress]);

  const markStepComplete = useCallback((stepId: string) => {
    setLastCompletedStep(stepId);
    checkProgress(); // Refresh from database
  }, [checkProgress]);

  const skipStep = useCallback((stepId: string) => {
    if (!user?.id) return;
    
    const newSkipped = [...skippedSteps, stepId];
    setSkippedSteps(newSkipped);
    localStorage.setItem(`${SETUP_PROGRESS_KEY}-skipped-${user.id}`, JSON.stringify(newSkipped));
  }, [user?.id, skippedSteps]);

  const unskipStep = useCallback((stepId: string) => {
    if (!user?.id) return;
    
    const newSkipped = skippedSteps.filter(id => id !== stepId);
    setSkippedSteps(newSkipped);
    localStorage.setItem(`${SETUP_PROGRESS_KEY}-skipped-${user.id}`, JSON.stringify(newSkipped));
  }, [user?.id, skippedSteps]);

  const clearCelebration = useCallback(() => {
    setLastCompletedStep(null);
  }, []);

  const getCompletionPercentage = useCallback(() => {
    const steps = [
      { completed: progress.colorsConfirmed, skipped: skippedSteps.includes('colors') },
      { completed: progress.companyProfileComplete, skipped: skippedSteps.includes('profile') },
      { completed: progress.posIntegrated, skipped: skippedSteps.includes('pos') },
      { completed: progress.clientListImported, skipped: skippedSteps.includes('clients') },
      { completed: progress.domainConfigured, skipped: skippedSteps.includes('domain') },
      { completed: progress.socialConnected, skipped: skippedSteps.includes('social') },
      { completed: progress.googleAnalyticsConnected, skipped: skippedSteps.includes('analytics') },
      { completed: progress.smsSetupComplete, skipped: skippedSteps.includes('sms') },
      { completed: progress.firstEmailCampaignSent, skipped: skippedSteps.includes('first-email') },
      { completed: progress.firstAutomationCreated, skipped: skippedSteps.includes('first-automation') },
      { completed: progress.customerSegmentsCreated, skipped: skippedSteps.includes('segments') },
      { completed: progress.newsletterTemplateSent, skipped: skippedSteps.includes('newsletter') },
    ];

    const completedOrSkipped = steps.filter(s => s.completed || s.skipped).length;
    return Math.round((completedOrSkipped / steps.length) * 100);
  }, [progress, skippedSteps]);

  return {
    progress,
    skippedSteps,
    isLoading,
    lastCompletedStep,
    markStepComplete,
    skipStep,
    unskipStep,
    clearCelebration,
    getCompletionPercentage,
    refreshProgress: checkProgress,
  };
};
