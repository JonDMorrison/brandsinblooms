import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { emailDomainsConfig } from '@/lib/config/emailDomainsConfig';

// Declare Entri global types
declare global {
  interface Window {
    entri?: {
      showEntri: (config: EntriConfig) => void;
    };
  }
}

interface EntriConfig {
  applicationId: string;
  token?: string;
  dnsRecords: EntriDnsRecord[];
  onSuccess?: (result: EntriSuccessResult) => void;
  onError?: (error: EntriError) => void;
  onClose?: () => void;
}

interface EntriDnsRecord {
  type: 'TXT' | 'CNAME' | 'MX' | 'A' | 'AAAA';
  host: string;
  value: string;
  ttl?: number;
}

interface EntriSuccessResult {
  domain: string;
  provider: string;
  connectionId?: string;
  setupToken?: string;
}

interface EntriError {
  message: string;
  code?: string;
}

// DNS records required for email authentication
const EMAIL_DNS_RECORDS: EntriDnsRecord[] = [
  {
    type: 'TXT',
    host: '@',
    value: 'v=spf1 include:_spf.resend.com ~all',
    ttl: 3600
  },
  {
    type: 'CNAME',
    host: 'resend._domainkey',
    value: 'resend._domainkey.resend.com',
    ttl: 3600
  },
  {
    type: 'TXT',
    host: '_dmarc',
    value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@bloomsuite.app',
    ttl: 3600
  }
];

// Entri configuration from centralized config
const ENTRI_APPLICATION_ID = emailDomainsConfig.entriAppId;
const ENTRI_SCRIPT_URL = emailDomainsConfig.entriScriptUrl;

// Fetch JWT token from server-side edge function
async function fetchEntriToken(): Promise<{ token: string; applicationId: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('entri-get-token');
    
    if (error) {
      console.error('Error fetching Entri token:', error);
      return null;
    }
    
    if (data?.token) {
      console.log('Entri token fetched successfully');
      return { token: data.token, applicationId: data.applicationId || ENTRI_APPLICATION_ID };
    }
    
    return null;
  } catch (err) {
    console.error('Failed to fetch Entri token:', err);
    return null;
  }
}

export const useEntriConnect = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Load Entri script dynamically
  const loadEntriScript = useCallback(async (): Promise<boolean> => {
    if (window.entri) {
      setIsScriptLoaded(true);
      return true;
    }

    return new Promise((resolve) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${ENTRI_SCRIPT_URL}"]`);
      if (existingScript) {
        // Wait for it to load
        existingScript.addEventListener('load', () => {
          setIsScriptLoaded(true);
          resolve(true);
        });
        return;
      }

      const script = document.createElement('script');
      script.src = ENTRI_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        setIsScriptLoaded(true);
        resolve(true);
      };
      script.onerror = () => {
        console.error('Failed to load Entri script');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }, []);

  // Pre-load script on mount
  useEffect(() => {
    loadEntriScript();
  }, [loadEntriScript]);

  const normalizeDomain = useCallback((value: string) => {
    return value.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
  }, []);

  /**
   * Open Entri setup modal for automatic DNS configuration
   */
  const openEntriSetup = useCallback(async (
    domain: string,
    accountId: string,
    dnsRecords?: EntriDnsRecord[],
    onSuccess?: () => void,
    onCancel?: () => void
  ) => {
    setIsLoading(true);

    // Track whether this session completed successfully.
    // Entri may call onClose after onSuccess; we must not treat that as a cancel.
    let didComplete = false;

    try {
      // Ensure script is loaded
      const loaded = await loadEntriScript();
      if (!loaded || !window.entri) {
        toast.error('Failed to load DNS setup tool. Please try manual setup.');
        onCancel?.();
        return;
      }

      if (!emailDomainsConfig.isEntriConfigured()) {
        toast.error('Entri integration not configured. Please contact support.');
        console.error('Entri Application ID not configured in emailDomainsConfig');
        onCancel?.();
        return;
      }

      const normalizedDomain = normalizeDomain(domain);

      // Use provided DNS records or default email authentication records
      const records = dnsRecords || EMAIL_DNS_RECORDS;

      // Fetch authenticated JWT token from server
      const tokenData = await fetchEntriToken();
      if (!tokenData) {
        toast.error('Failed to authenticate with DNS setup service. Please try manual setup.');
        onCancel?.();
        setIsLoading(false);
        return;
      }

      // Open Entri modal with authenticated token
      window.entri.showEntri({
        applicationId: tokenData.applicationId,
        token: tokenData.token,
        dnsRecords: records,
        onSuccess: async (result: EntriSuccessResult) => {
          didComplete = true;

          const domainFromEntri = normalizeDomain(result.domain || normalizedDomain);
          console.log('Entri setup successful:', { ...result, domain: domainFromEntri });

          try {
            // Call our edge function to save the Entri connection
            const { data, error } = await supabase.functions.invoke('entri-domain-callback', {
              body: {
                accountId,
                domain: domainFromEntri,
                entriConnectionId: result.connectionId || result.setupToken || 'entri-success',
                entriProvider: result.provider
              }
            });

            if (error) {
              console.error('Error saving Entri connection:', error);
              toast.error('DNS configured but failed to save. Please refresh and check status.');
            } else {
              toast.success(`DNS configured via ${result.provider}! Verifying...`);
              onSuccess?.();
            }
          } catch (err) {
            console.error('Error in Entri success callback:', err);
            toast.error('DNS configured but encountered an error. Please refresh.');
          }
        },
        onError: (error: EntriError) => {
          console.error('Entri setup error:', error);
          toast.error(error.message || 'DNS setup failed. You can try manual setup.');
          onCancel?.();
        },
        onClose: () => {
          console.log('Entri modal closed by user');
          if (!didComplete) {
            // Only treat close as cancel if the session did not complete.
            onCancel?.();
          }
        }
      });
    } catch (err: any) {
      console.error('Error opening Entri:', err);
      toast.error('Failed to open DNS setup. Please try manual setup.');
      onCancel?.();
    } finally {
      setIsLoading(false);
    }
  }, [loadEntriScript, normalizeDomain]);

  /**
   * Generate custom DNS records based on domain-specific requirements
   */
  const generateDnsRecords = useCallback((domain: string, resendDnsRecords?: any): EntriDnsRecord[] => {
    if (resendDnsRecords) {
      // Convert Resend DNS records to Entri format
      const records: EntriDnsRecord[] = [];
      
      if (resendDnsRecords.dkim) {
        resendDnsRecords.dkim.forEach((record: any) => {
          records.push({
            type: record.type as 'TXT' | 'CNAME',
            host: record.name.replace(`.${domain}`, ''),
            value: record.value,
            ttl: record.ttl || 3600
          });
        });
      }
      
      if (resendDnsRecords.spf) {
        resendDnsRecords.spf.forEach((record: any) => {
          records.push({
            type: 'TXT',
            host: record.name === domain ? '@' : record.name.replace(`.${domain}`, ''),
            value: record.value,
            ttl: record.ttl || 3600
          });
        });
      }
      
      if (resendDnsRecords.return_path) {
        records.push({
          type: resendDnsRecords.return_path.type as 'CNAME',
          host: resendDnsRecords.return_path.name.replace(`.${domain}`, ''),
          value: resendDnsRecords.return_path.value,
          ttl: resendDnsRecords.return_path.ttl || 3600
        });
      }
      
      return records.length > 0 ? records : EMAIL_DNS_RECORDS;
    }
    
    return EMAIL_DNS_RECORDS;
  }, []);

  return {
    openEntriSetup,
    generateDnsRecords,
    isLoading,
    isScriptLoaded,
    isEntriConfigured: emailDomainsConfig.isEntriConfigured()
  };
};
