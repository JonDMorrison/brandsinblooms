
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export interface EmailDomain {
  id: string;
  tenant_id: string;
  domain: string;
  resend_domain_id?: string;
  status: 'pending' | 'verifying' | 'active' | 'error';
  error?: string;
  report_email?: string;
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

  const createEmailDomain = async (domain: string, reportEmail?: string) => {
    if (!tenant?.id) return null;

    try {
      const { data, error } = await supabase.functions.invoke('email-domain-create', {
        body: {
          tenantId: tenant.id,
          domain,
          reportEmail
        }
      });

      if (error) throw error;
      await fetchEmailDomains();
      return data;
    } catch (error) {
      console.error('Error creating email domain:', error);
      throw error;
    }
  };

  const verifyEmailDomain = async (domainId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('email-domain-verify', {
        body: { domainId }
      });

      if (error) throw error;
      await fetchEmailDomains();
      return data;
    } catch (error) {
      console.error('Error verifying email domain:', error);
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

  return {
    emailDomains,
    loading,
    createEmailDomain,
    verifyEmailDomain,
    updateEmailDomain,
    deleteEmailDomain,
    getDomainRecords,
    getDomainChecks,
    refetch: fetchEmailDomains
  };
};
