import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { 
  EmailDomain, 
  QuotaCheckResult, 
  canSendCampaign,
  getActiveOrFallbackSender
} from '@/lib/email/domainService';

export interface DomainUsageStats {
  date: string;
  emails_sent: number;
  bounces: number;
  complaints: number;
}

export const useEmailDomainManagement = () => {
  const { tenant } = useTenant();
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    if (!tenant?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('email_domains')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setDomains((data || []) as unknown as EmailDomain[]);
    } catch (err: any) {
      console.error('Error fetching email domains:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (tenant?.id) {
      fetchDomains();
    }
  }, [tenant?.id, fetchDomains]);

  /**
   * Provision a new sending domain
   */
  const provisionDomain = async (domain: string): Promise<{ success: boolean; data?: any; error?: string }> => {
    if (!tenant?.id) {
      return { success: false, error: 'No tenant context' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('email-domain-create', {
        body: {
          tenantId: tenant.id,
          domain,
          provider: 'manual'
        }
      });

      if (error) throw error;
      
      toast.success('Domain provisioning started. Please add the DNS records shown below.');
      await fetchDomains();
      
      return { success: true, data };
    } catch (err: any) {
      console.error('Error provisioning domain:', err);
      toast.error(err.message || 'Failed to provision domain');
      return { success: false, error: err.message };
    }
  };

  /**
   * Refresh domain verification status from Resend
   */
  const refreshVerificationStatus = async (domainId: string): Promise<{ success: boolean; verified?: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke('email-domain-verify', {
        body: { email_domain_id: domainId }
      });

      if (error) throw error;
      
      const isVerified = data?.ok || data?.status === 'active';
      
      toast[isVerified ? 'success' : 'info'](
        isVerified 
          ? 'Domain verified! Warmup period has begun.' 
          : 'DNS records still pending. Please check your DNS settings.'
      );
      
      await fetchDomains();
      return { success: true, verified: isVerified };
    } catch (err: any) {
      console.error('Error verifying domain:', err);
      toast.error(err.message || 'Failed to verify domain');
      return { success: false };
    }
  };

  /**
   * Update domain sender settings
   */
  const updateDomainSender = async (
    domainId: string, 
    fromName: string, 
    fromEmail: string
  ): Promise<{ success: boolean }> => {
    try {
      // Validate email belongs to the domain
      const domain = domains.find(d => d.id === domainId);
      if (domain && !fromEmail.endsWith(`@${domain.domain}`)) {
        toast.error(`Email must be on the ${domain.domain} domain`);
        return { success: false };
      }

      const { error } = await supabase
        .from('email_domains')
        .update({
          default_from_name: fromName,
          default_from_email: fromEmail,
          updated_at: new Date().toISOString()
        })
        .eq('id', domainId);

      if (error) throw error;
      
      toast.success('Sender settings updated');
      await fetchDomains();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating domain sender:', err);
      toast.error(err.message || 'Failed to update sender settings');
      return { success: false };
    }
  };

  /**
   * Pause or resume a domain
   */
  const toggleDomainPause = async (domainId: string, pause: boolean): Promise<{ success: boolean }> => {
    try {
      const updates: any = {
        manual_pause: pause,
        updated_at: new Date().toISOString()
      };

      if (pause) {
        updates.notes = `Manually paused on ${new Date().toISOString()}`;
      }

      const { error } = await supabase
        .from('email_domains')
        .update(updates)
        .eq('id', domainId);

      if (error) throw error;
      
      toast.success(pause ? 'Domain paused' : 'Domain resumed');
      await fetchDomains();
      return { success: true };
    } catch (err: any) {
      console.error('Error toggling domain pause:', err);
      toast.error(err.message || 'Failed to update domain');
      return { success: false };
    }
  };

  /**
   * Delete a domain
   */
  const deleteDomain = async (domainId: string): Promise<{ success: boolean }> => {
    try {
      const { error } = await supabase
        .from('email_domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;
      
      toast.success('Domain removed');
      await fetchDomains();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting domain:', err);
      toast.error(err.message || 'Failed to delete domain');
      return { success: false };
    }
  };

  /**
   * Get domain usage stats for the last N days
   */
  const getDomainUsageStats = async (domainId: string, days: number = 30): Promise<DomainUsageStats[]> => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('email_domain_usage')
        .select('date, emails_sent, bounces, complaints')
        .eq('email_domain_id', domainId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      
      // Aggregate by date
      const aggregated = (data || []).reduce((acc: Record<string, DomainUsageStats>, row: any) => {
        const date = row.date;
        if (!acc[date]) {
          acc[date] = { date, emails_sent: 0, bounces: 0, complaints: 0 };
        }
        acc[date].emails_sent += row.emails_sent || 0;
        acc[date].bounces += row.bounces || 0;
        acc[date].complaints += row.complaints || 0;
        return acc;
      }, {});

      return Object.values(aggregated);
    } catch (err) {
      console.error('Error fetching domain usage:', err);
      return [];
    }
  };

  /**
   * Check if a campaign can be sent
   */
  const checkCampaignQuota = async (
    domainId: string | null, 
    recipientCount: number
  ): Promise<QuotaCheckResult> => {
    if (!tenant?.id) {
      return { allowed: false, reason: 'no_tenant', message: 'No workspace context' };
    }
    return canSendCampaign(tenant.id, domainId, recipientCount);
  };

  /**
   * Get the best available sender for this account
   */
  const getDefaultSender = async () => {
    if (!tenant?.id) {
      return {
        fromName: 'BloomSuite',
        fromEmail: 'noreply@bloomsuite.email',
        usingFallback: true
      };
    }
    return getActiveOrFallbackSender(tenant.id);
  };

  return {
    domains,
    loading,
    error,
    refetch: fetchDomains,
    provisionDomain,
    refreshVerificationStatus,
    updateDomainSender,
    toggleDomainPause,
    deleteDomain,
    getDomainUsageStats,
    checkCampaignQuota,
    getDefaultSender
  };
};
