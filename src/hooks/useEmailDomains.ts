
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface EmailDomain {
  id: string;
  tenant_id: string;
  domain: string;
  resend_domain_id?: string;
  status: 'pending' | 'verifying' | 'active' | 'error';
  error?: string;
  report_email?: string;
  env?: 'prod' | 'dev';
  is_sandbox?: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailDnsRecord {
  id: string;
  email_domain_id: string;
  name: string;
  type: 'TXT' | 'CNAME';
  value: string;
  required: boolean;
  purpose: 'dkim' | 'spf' | 'return-path' | 'verification' | 'dmarc';
  created_at: string;
}

export interface EmailDnsCheck {
  id: string;
  email_domain_id: string;
  check_name: string;
  ok: boolean;
  details: any;
  checked_at: string;
}

export const useEmailDomains = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [emailDomains, setEmailDomains] = useState<EmailDomain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant?.id) {
      fetchEmailDomains();
    }
  }, [tenant?.id]);

  const fetchEmailDomains = async () => {
    try {
      const { data, error } = await supabase
        .from('email_domains')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmailDomains((data || []) as EmailDomain[]);
    } catch (error) {
      console.error('Error fetching email domains:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDomainRecords = async (domainId: string): Promise<EmailDnsRecord[]> => {
    try {
      const { data, error } = await supabase
        .from('email_dns_records')
        .select('*')
        .eq('email_domain_id', domainId)
        .order('purpose', { ascending: true });

      if (error) throw error;
      return (data || []) as EmailDnsRecord[];
    } catch (error) {
      console.error('Error fetching DNS records:', error);
      return [];
    }
  };

  const getDomainChecks = async (domainId: string): Promise<EmailDnsCheck[]> => {
    try {
      const { data, error } = await supabase
        .from('email_dns_checks')
        .select('*')
        .eq('email_domain_id', domainId)
        .order('checked_at', { ascending: false });

      if (error) throw error;
      return (data || []) as EmailDnsCheck[];
    } catch (error) {
      console.error('Error fetching DNS checks:', error);
      return [];
    }
  };

  const createEmailDomain = async (domain?: string, reportEmail?: string, useSandbox?: boolean) => {
    if (!tenant?.id) return null;

    try {
      const { data, error } = await supabase.functions.invoke('email-domain-create', {
        body: {
          tenantId: tenant.id,
          domain,
          reportEmail,
          useSandbox
        }
      });

      if (error) throw error;
      
      toast.success(useSandbox 
        ? "Sandbox domain created successfully! DNS records have been applied automatically."
        : "Your email domain has been set up successfully."
      );
      
      await fetchEmailDomains();
      return data;
    } catch (error: any) {
      console.error('Error creating email domain:', error);
      
      if (error.message?.includes('Domain managed by another workspace')) {
        toast.error('This domain is already configured for another workspace. Please use a different domain.');
      } else {
        toast.error(error.message || 'Failed to create email domain');
      }
      throw error;
    }
  };

  const verifyEmailDomain = async (domainId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('email-domain-verify', {
        body: { email_domain_id: domainId }
      });

      if (error) throw error;
      
      const isSuccess = data.ok || data.status === 'active';
      
      toast[isSuccess ? 'success' : 'warning'](
        data.message || (isSuccess 
          ? "Domain is now active and ready to send emails"
          : "Some DNS records are still pending verification")
      );
      
      await fetchEmailDomains();
      return data;
    } catch (error: any) {
      console.error('Error verifying email domain:', error);
      toast.error(error.message || 'Failed to verify email domain');
      throw error;
    }
  };

  const updateEmailDomain = async (domainId: string, updates: Partial<EmailDomain>) => {
    try {
      const { data, error } = await supabase
        .from('email_domains')
        .update(updates)
        .eq('id', domainId)
        .select()
        .single();

      if (error) throw error;
      await fetchEmailDomains();
      return data;
    } catch (error) {
      console.error('Error updating email domain:', error);
      throw error;
    }
  };

  const deleteEmailDomain = async (domainId: string) => {
    try {
      const { error } = await supabase
        .from('email_domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;
      await fetchEmailDomains();
    } catch (error) {
      console.error('Error deleting email domain:', error);
      throw error;
    }
  };

  // Get sandbox configuration
  const getSandboxConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('domain-sandbox-config');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting sandbox config:', error);
      return { enabled: false };
    }
  };

  return {
    emailDomains,
    loading,
    createEmailDomain,
    verifyEmailDomain,
    updateEmailDomain,
    deleteEmailDomain,
    getDomainRecords,
    getDomainChecks,
    getSandboxConfig,
    refetch: fetchEmailDomains
  };
};
