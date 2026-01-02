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

// Default DNS records - only used as absolute fallback
// These should come from the backend (Resend API) for accuracy
const FALLBACK_EMAIL_DNS_RECORDS: EntriDnsRecord[] = [
  {
    type: 'TXT',
    host: '@',
    value: 'v=spf1 include:_spf.resend.com ~all',
    ttl: 3600
  },
  {
    type: 'CNAME',
    host: 'resend._domainkey',
    value: 'resend._domainkey.resend.dev',
    ttl: 3600
  },
  {
    type: 'CNAME',
    host: 'send',
    value: 'send.resend.com',
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

      // Use provided DNS records or fallback defaults
      // IMPORTANT: Records should come from backend (Resend API) for accuracy
      if (!dnsRecords || dnsRecords.length === 0) {
        console.warn('⚠️ No DNS records provided to Entri, using fallback records. Return-Path may be missing!');
      }
      const records = dnsRecords && dnsRecords.length > 0 ? dnsRecords : FALLBACK_EMAIL_DNS_RECORDS;
      
      // Log records being sent to Entri for debugging
      console.log(`📋 Opening Entri for domain: ${normalizedDomain}`);
      console.log(`📋 DNS records being applied (${records.length}):`, JSON.stringify(records, null, 2));

      // Fetch authenticated JWT token from server
      const tokenData = await fetchEntriToken();
      if (!tokenData) {
        toast.error('Failed to authenticate with DNS setup service. Please try manual setup.');
        onCancel?.();
        setIsLoading(false);
        return;
      }

      // Entri recommends listening for browser callback events (CustomEvent)
      const successEventName = 'onSuccess';
      const closeEventName = 'onEntriClose';

      const handleCompletion = async (detail: EntriBrowserEventDetail) => {
        // Mark complete immediately so close isn't treated as cancel.
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
        // Fire-and-forget; close event can follow quickly.
        void handleCompletion(detail);
      };

      const onCloseEvent = (evt: Event) => {
        const detail = (evt as CustomEvent).detail as EntriBrowserEventDetail;
        console.log('Entri modal closed:', detail);

        // If we didn't already handle success, use close payload to decide.
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

      // Register listeners before opening the modal
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
   * Convert backend DNS records to Entri format
   * Backend records have: { name, type, value, purpose }
   * Entri needs: { type, host, value, ttl }
   */
  const convertToEntriRecords = useCallback((domain: string, backendRecords: Array<{name: string; type: string; value: string; purpose?: string}>): EntriDnsRecord[] => {
    console.log(`📋 Converting ${backendRecords.length} backend records to Entri format for domain: ${domain}`);
    
    const entriRecords: EntriDnsRecord[] = [];
    
    for (const record of backendRecords) {
      // Convert full domain name to host (relative to domain)
      let host = record.name;
      
      // Remove the domain suffix to get relative host
      if (host.endsWith(`.${domain}`)) {
        host = host.replace(`.${domain}`, '');
      } else if (host === domain) {
        host = '@';
      }
      
      const entriRecord: EntriDnsRecord = {
        type: record.type as 'TXT' | 'CNAME' | 'MX' | 'A' | 'AAAA',
        host,
        value: record.value,
        ttl: 3600
      };
      
      entriRecords.push(entriRecord);
      console.log(`  ✓ ${entriRecord.type} ${entriRecord.host} -> ${entriRecord.value.substring(0, 50)}...`);
    }
    
    return entriRecords;
  }, []);

  /**
   * Validate that required DNS records are present
   */
  const validateDnsRecords = useCallback((records: EntriDnsRecord[]): { valid: boolean; missing: string[] } => {
    const missing: string[] = [];
    
    // Check for SPF (TXT record at @ or domain root with spf)
    const hasSpf = records.some(r => r.type === 'TXT' && r.value.includes('spf'));
    if (!hasSpf) missing.push('SPF');
    
    // Check for DKIM (CNAME or TXT with domainkey)
    const hasDkim = records.some(r => r.host.includes('domainkey') || r.host.includes('dkim'));
    if (!hasDkim) missing.push('DKIM');
    
    // Check for Return-Path (CNAME for send or return subdomain)
    const hasReturnPath = records.some(r => 
      r.type === 'CNAME' && (r.host === 'send' || r.host === 'return' || r.value.includes('send.resend'))
    );
    if (!hasReturnPath) missing.push('Return-Path');
    
    console.log(`📋 DNS validation: SPF=${hasSpf}, DKIM=${hasDkim}, Return-Path=${hasReturnPath}`);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }, []);

  return {
    openEntriSetup,
    convertToEntriRecords,
    validateDnsRecords,
    isLoading,
    isScriptLoaded,
    isEntriConfigured: emailDomainsConfig.isEntriConfigured(),
    FALLBACK_RECORDS: FALLBACK_EMAIL_DNS_RECORDS
  };
};
