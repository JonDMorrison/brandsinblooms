
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export interface Domain {
  id: string;
  tenant_id: string;
  user_id?: string;
  domain: string;
  type: 'system_path' | 'custom';
  status: 'pending' | 'active' | 'error' | 'archived';
  dns_status: 'unknown' | 'pending' | 'propagating' | 'verified' | 'error';
  tls_status: 'unknown' | 'pending' | 'active' | 'error';
  desired_state: any;
  path_prefix?: string;
  is_primary: boolean;
  last_checked_at?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSender {
  id: string;
  tenant_id: string;
  domain_id?: string;
  sender_email: string;
  display_name?: string;
  status: 'pending' | 'verifying' | 'verified' | 'failed';
  provider: string;
  provider_domain_id?: string;
  dkim_host?: string;
  dkim_value?: string;
  spf_value?: string;
  dmarc_value?: string;
  last_verified_at?: string;
  verified: boolean;
  error?: string;
  created_at: string;
  updated_at: string;
}

export const useDomains = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [emailSenders, setEmailSenders] = useState<EmailSender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant?.id) {
      fetchDomains();
      fetchEmailSenders();
    }
  }, [tenant?.id]);

  const fetchDomains = async () => {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDomains((data || []) as Domain[]);
    } catch (error) {
      console.error('Error fetching domains:', error);
    }
  };

  const fetchEmailSenders = async () => {
    try {
      const { data, error } = await supabase
        .from('email_senders')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmailSenders((data || []) as EmailSender[]);
    } catch (error) {
      console.error('Error fetching email senders:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSystemPath = async (slug: string) => {
    if (!tenant?.id) return null;

    try {
      const { data, error } = await supabase
        .from('domains')
        .insert({
          tenant_id: tenant.id,
          user_id: user?.id,
          domain: 'pages.bloomsuite.app',
          type: 'system_path',
          status: 'active',
          dns_status: 'verified',
          tls_status: 'active',
          path_prefix: `/t/${slug}`,
          is_primary: true,
          verified_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      await fetchDomains();
      return data;
    } catch (error) {
      console.error('Error creating system path:', error);
      throw error;
    }
  };

  const addCustomDomain = async (domain: string) => {
    if (!tenant?.id) return null;

    try {
      const { data, error } = await supabase
        .from('domains')
        .insert({
          tenant_id: tenant.id,
          user_id: user?.id,
          domain,
          type: 'custom',
          status: 'pending',
          dns_status: 'pending',
          tls_status: 'unknown'
        })
        .select()
        .single();

      if (error) throw error;
      await fetchDomains();
      return data;
    } catch (error) {
      console.error('Error adding custom domain:', error);
      throw error;
    }
  };

  const addEmailSender = async (senderEmail: string, displayName?: string) => {
    if (!tenant?.id) return null;

    try {
      const { data, error } = await supabase
        .from('email_senders')
        .insert({
          tenant_id: tenant.id,
          sender_email: senderEmail,
          display_name: displayName,
          status: 'pending',
          provider: 'resend'
        })
        .select()
        .single();

      if (error) throw error;
      await fetchEmailSenders();
      return data;
    } catch (error) {
      console.error('Error adding email sender:', error);
      throw error;
    }
  };

  return {
    domains,
    emailSenders,
    loading,
    createSystemPath,
    addCustomDomain,
    addEmailSender,
    refetch: () => {
      fetchDomains();
      fetchEmailSenders();
    }
  };
};
