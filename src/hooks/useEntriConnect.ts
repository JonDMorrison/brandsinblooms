import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// TODO: Replace with actual Entri Application ID from environment
const ENTRI_APPLICATION_ID = import.meta.env.VITE_ENTRI_APPLICATION_ID || 'YOUR_ENTRI_APP_ID';
const ENTRI_SCRIPT_URL = 'https://cdn.goentri.com/entri.js';

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

    try {
      // Ensure script is loaded
      const loaded = await loadEntriScript();
      if (!loaded || !window.entri) {
        toast.error('Failed to load DNS setup tool. Please try manual setup.');
        onCancel?.();
        return;
      }

      if (ENTRI_APPLICATION_ID === 'YOUR_ENTRI_APP_ID') {
        toast.error('Entri integration not configured. Please contact support.');
        console.error('VITE_ENTRI_APPLICATION_ID environment variable not set');
        onCancel?.();
        return;
      }

      // Use provided DNS records or default email authentication records
      const records = dnsRecords || EMAIL_DNS_RECORDS;

      // Open Entri modal
      window.entri.showEntri({
        applicationId: ENTRI_APPLICATION_ID,
        dnsRecords: records,
        onSuccess: async (result: EntriSuccessResult) => {
          console.log('Entri setup successful:', result);
          
          try {
            // Call our edge function to save the Entri connection
            const { data, error } = await supabase.functions.invoke('entri-domain-callback', {
              body: {
                accountId,
                domain: result.domain || domain,
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
          console.log('Entri modal closed');
          // Don't call onCancel here - user might have succeeded
        }
      });
    } catch (err: any) {
      console.error('Error opening Entri:', err);
      toast.error('Failed to open DNS setup. Please try manual setup.');
      onCancel?.();
    } finally {
      setIsLoading(false);
    }
  }, [loadEntriScript]);

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
    isEntriConfigured: ENTRI_APPLICATION_ID !== 'YOUR_ENTRI_APP_ID'
  };
};
