import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { emailDomainsConfig } from '@/lib/config/emailDomainsConfig';
import { 
  prepareRecordsForEntri, 
  validateCanonicalRecords,
  DnsRecord,
  ValidationResult 
} from '@/lib/email/dnsRecordSanitizer';

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
}

export interface EntriDnsRecord {
  type: 'TXT' | 'CNAME' | 'MX' | 'A' | 'AAAA';
  host: string;
  value: string;
  ttl?: number;
  priority?: number; // Required for MX records
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

// Entri browser callback event payload (CustomEvent.detail)
interface EntriBrowserEventDetail {
  domain?: string;
  provider?: string;
  setupType?: string;
  success?: boolean;
  connectionId?: string;
  setupToken?: string;
  lastStatus?: string;
}

// Fallback DNS records - ONLY used when backend fails
// These include the canonical Resend records WITH MX priority
const FALLBACK_EMAIL_DNS_RECORDS: EntriDnsRecord[] = [
  {
    type: 'CNAME',
    host: 'resend._domainkey',
    value: 'resend._domainkey.resend.com',
    ttl: 3600
  },
  {
    type: 'MX',
    host: 'send',
    value: 'feedback-smtp.us-east-1.amazonses.com',
    priority: 10,
    ttl: 3600
  },
  {
    type: 'TXT',
    host: 'send',
    value: 'v=spf1 include:amazonses.com ~all',
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
      const existingScript = document.querySelector(`script[src="${ENTRI_SCRIPT_URL}"]`);
      if (existingScript) {
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

    let didComplete = false;

    try {
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

      // Use provided DNS records or fallback defaults
      if (!dnsRecords || dnsRecords.length === 0) {
        console.warn('⚠️ No DNS records provided to Entri, using fallback records.');
      }
      const records = dnsRecords && dnsRecords.length > 0 ? dnsRecords : FALLBACK_EMAIL_DNS_RECORDS;
      
      // Log records being sent to Entri for debugging
      console.log(`📋 Opening Entri for domain: ${normalizedDomain}`);
      console.log(`📋 DNS records being applied (${records.length}):`, JSON.stringify(records, null, 2));
      
      // Verify MX records have priority
      const mxRecords = records.filter(r => r.type === 'MX');
      for (const mx of mxRecords) {
        if (mx.priority === undefined) {
          console.error(`❌ MX record "${mx.host}" is missing priority!`);
        } else {
          console.log(`✅ MX record "${mx.host}" has priority: ${mx.priority}`);
        }
      }

      // Fetch authenticated JWT token from server
      const tokenData = await fetchEntriToken();
      if (!tokenData) {
        toast.error('Failed to authenticate with DNS setup service. Please try manual setup.');
        onCancel?.();
        setIsLoading(false);
        return;
      }

      const successEventName = 'onSuccess';
      const closeEventName = 'onEntriClose';

      const handleCompletion = async (detail: EntriBrowserEventDetail) => {
        didComplete = true;

        const domainFromEntri = normalizeDomain(detail.domain || normalizedDomain);
        const entriProvider = detail.provider || detail.setupType || 'entri';
        const entriConnectionId = detail.connectionId || detail.setupToken || detail.lastStatus || 'entri-success';

        console.log('Entri setup completed:', {
          domain: domainFromEntri,
          entriProvider,
          entriConnectionId,
          detail,
        });

        try {
          const { error } = await supabase.functions.invoke('entri-domain-callback', {
            body: {
              accountId,
              domain: domainFromEntri,
              entriConnectionId,
              entriProvider,
            },
          });

          if (error) {
            console.error('Error saving Entri connection:', error);
            toast.error('DNS configured but failed to save in BloomSuite. Please refresh and try again.');
            return;
          }

          toast.success(`DNS configured via ${entriProvider}! Verifying...`);
          onSuccess?.();
        } catch (err) {
          console.error('Error in Entri completion handler:', err);
          toast.error('DNS configured but encountered an error saving in BloomSuite. Please refresh.');
        }
      };

      const onSuccessEvent = (evt: Event) => {
        const detail = (evt as CustomEvent).detail as EntriBrowserEventDetail;
        void handleCompletion(detail);
      };

      const onCloseEvent = (evt: Event) => {
        const detail = (evt as CustomEvent).detail as EntriBrowserEventDetail;
        console.log('Entri modal closed:', detail);

        if (!didComplete) {
          if (detail?.success) {
            void handleCompletion(detail);
          } else {
            onCancel?.();
          }
        }

        window.removeEventListener(successEventName, onSuccessEvent as EventListener);
        window.removeEventListener(closeEventName, onCloseEvent as EventListener);
      };

      window.addEventListener(successEventName, onSuccessEvent as EventListener);
      window.addEventListener(closeEventName, onCloseEvent as EventListener);

      // Open Entri modal with authenticated token
      window.entri.showEntri({
        applicationId: tokenData.applicationId,
        token: tokenData.token,
        dnsRecords: records,
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
   * Sanitize and convert backend DNS records to Entri format.
   * Enforces Resend's canonical model: DKIM CNAME only, MX with priority.
   * 
   * @returns Object with sanitized records and validation result
   */
  const sanitizeAndConvertRecords = useCallback((
    domain: string, 
    backendRecords: Array<{name: string; type: string; value: string; priority?: number; purpose?: string}>
  ): { records: EntriDnsRecord[]; validation: ValidationResult } => {
    console.log(`🧹 Sanitizing ${backendRecords.length} DNS records for domain: ${domain}`);
    
    // Use the centralized sanitizer
    const { records, validation } = prepareRecordsForEntri(domain, backendRecords);
    
    // Convert to Entri format, preserving priority
    const entriRecords: EntriDnsRecord[] = records.map(r => {
      const entri: EntriDnsRecord = {
        type: r.type,
        host: r.host,
        value: r.value,
        ttl: r.ttl || 3600
      };
      
      // Include priority for MX records
      if (r.type === 'MX' && r.priority !== undefined) {
        entri.priority = r.priority;
      }
      
      return entri;
    });
    
    return { records: entriRecords, validation };
  }, []);

  /**
   * Validate Entri-format records strictly
   */
  const validateRecordsStrict = useCallback((records: EntriDnsRecord[]): ValidationResult => {
    // Convert to DnsRecord format for validation
    const dnsRecords: DnsRecord[] = records.map(r => ({
      type: r.type,
      host: r.host,
      value: r.value,
      ttl: r.ttl,
      priority: r.priority
    }));
    
    return validateCanonicalRecords(dnsRecords);
  }, []);

  return {
    openEntriSetup,
    sanitizeAndConvertRecords,
    validateRecordsStrict,
    isLoading,
    isScriptLoaded,
    isEntriConfigured: emailDomainsConfig.isEntriConfigured(),
    FALLBACK_RECORDS: FALLBACK_EMAIL_DNS_RECORDS
  };
};
