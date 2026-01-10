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
        .select('brand_primary_color, brand_secondary_color, company_name, company_overview, brand_voice')
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
