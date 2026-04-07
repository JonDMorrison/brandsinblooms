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

// SAFETY: NO FALLBACK RECORDS
// If Resend fails to return DNS records, we abort automatic setup.
// We NEVER guess DNS values - this prevents email disruption.
// Automatic setup is only allowed with records directly from Resend API.

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

  // Pre-load script on mount only if Entri is configured
  useEffect(() => {
    if (emailDomainsConfig.isEntriConfigured()) {
      loadEntriScript();
    }
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
    onCancel?: () => void,
    onClose?: () => void
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

      // SAFETY: Abort if no DNS records from backend
      // We NEVER use fallback records - they could disrupt existing email
      if (!dnsRecords || dnsRecords.length === 0) {
        console.error('❌ No DNS records from Resend. Aborting automatic setup for safety.');
        toast.error('Unable to retrieve DNS records. Please use manual setup.');
        onCancel?.();
        setIsLoading(false);
        return;
      }

      // SAFETY: Strip any DMARC or root-level records before sending to Entri
      // We NEVER auto-configure root-domain email policy
      const safeRecords = dnsRecords.filter(r => {
        const host = r.host.toLowerCase();
        // Block DMARC records
        if (host === '_dmarc' || host.startsWith('_dmarc.')) {
          console.warn(`🛡️ Stripped DMARC record from auto-apply: ${host}`);
          return false;
        }
        // Block root-level records (@ or empty host)
        if (host === '@' || host === '') {
          console.warn(`🛡️ Stripped root-level record from auto-apply: ${r.type} ${host}`);
          return false;
        }
        return true;
      });

      // SAFETY: Verify we still have required subdomain records after filtering
      const hasDkim = safeRecords.some(r => r.host.includes('domainkey'));
      const hasMxOrSpf = safeRecords.some(r => r.type === 'MX' || (r.type === 'TXT' && r.value.includes('spf')));
      
      if (!hasDkim || !hasMxOrSpf) {
        console.error('❌ Missing required subdomain records after safety filter. Aborting.');
        toast.error('DNS configuration incomplete. Please use manual setup.');
        onCancel?.();
        setIsLoading(false);
        return;
      }

      // SAFETY: Perform silent DNS preflight check
      // If target subdomains already have records, abort to manual
      const preflightPassed = await performDnsPreflightCheck(normalizedDomain, safeRecords);
      if (!preflightPassed) {
        console.log('🛡️ DNS preflight detected existing records. Falling back to manual setup.');
        onCancel?.();
        setIsLoading(false);
        return;
      }
      
      // Log records being sent to Entri for debugging
      console.log(`📋 Opening Entri for domain: ${normalizedDomain}`);
      console.log(`📋 Safe DNS records being applied (${safeRecords.length}):`, JSON.stringify(safeRecords, null, 2));
      
      // Verify MX records have priority
      const mxRecords = safeRecords.filter(r => r.type === 'MX');
      for (const mx of mxRecords) {
        if (mx.priority === undefined) {
          console.error(`❌ MX record "${mx.host}" is missing priority!`);
        } else {
          console.log(`✅ MX record "${mx.host}" has priority: ${mx.priority}`);
        }
      }
      
      const records = safeRecords;

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

        // Always notify caller that the Entri overlay has closed,
        // so the parent component can clean up modal state.
        onClose?.();

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
    isEntriConfigured: emailDomainsConfig.isEntriConfigured()
  };
};

/**
 * SAFETY: Silent DNS preflight check
 * Checks if target subdomains already have DNS records.
 * If ANY conflict is detected, returns false (abort auto-setup).
 * This check is invisible to the user - no technical explanations shown.
 */
async function performDnsPreflightCheck(domain: string, records: EntriDnsRecord[]): Promise<boolean> {
  try {
    // Extract unique hosts we're about to write
    const targetHosts = new Set<string>();
    for (const r of records) {
      const host = r.host.toLowerCase();
      // Build FQDN for lookup
      let fqdn: string;
      if (host === '@' || host === '') {
        fqdn = domain;
      } else if (host.endsWith(domain)) {
        fqdn = host;
      } else {
        fqdn = `${host}.${domain}`;
      }
      targetHosts.add(fqdn);
    }

    console.log(`🔍 DNS Preflight: Checking ${targetHosts.size} target hosts...`);

    // Check each target host for existing records
    for (const fqdn of targetHosts) {
      try {
        // Check for TXT records
        const txtResponse = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fqdn)}&type=TXT`,
          { headers: { 'Accept': 'application/dns-json' } }
        );
        if (txtResponse.ok) {
          const txtData = await txtResponse.json();
          if (txtData.Answer && txtData.Answer.length > 0) {
            console.log(`🛡️ Preflight: Found existing TXT at ${fqdn}`);
            return false;
          }
        }

        // Check for CNAME records
        const cnameResponse = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fqdn)}&type=CNAME`,
          { headers: { 'Accept': 'application/dns-json' } }
        );
        if (cnameResponse.ok) {
          const cnameData = await cnameResponse.json();
          if (cnameData.Answer && cnameData.Answer.length > 0) {
            console.log(`🛡️ Preflight: Found existing CNAME at ${fqdn}`);
            return false;
          }
        }

        // Check for MX records (only for send subdomain)
        if (fqdn.startsWith('send.')) {
          const mxResponse = await fetch(
            `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fqdn)}&type=MX`,
            { headers: { 'Accept': 'application/dns-json' } }
          );
          if (mxResponse.ok) {
            const mxData = await mxResponse.json();
            if (mxData.Answer && mxData.Answer.length > 0) {
              console.log(`🛡️ Preflight: Found existing MX at ${fqdn}`);
              return false;
            }
          }
        }
      } catch (lookupError) {
        // DNS lookup failed - treat as safe to proceed (no existing records detected)
        console.log(`🔍 Preflight: Lookup for ${fqdn} inconclusive, proceeding...`);
      }
    }

    console.log(`✅ DNS Preflight: All clear, no conflicts detected.`);
    return true;
  } catch (error) {
    // If preflight check fails entirely, be conservative and allow manual
    console.error('🛡️ Preflight check failed, aborting auto-setup:', error);
    return false;
  }
}
