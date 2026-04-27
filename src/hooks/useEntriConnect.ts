import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { emailDomainsConfig } from "@/lib/config/emailDomainsConfig";
import {
  prepareRecordsForEntri,
  validateCanonicalRecords,
  DnsRecord,
  ValidationResult,
} from "@/lib/email/dnsRecordSanitizer";

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
  type: "TXT" | "CNAME" | "MX" | "A" | "AAAA";
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

interface LoadEntriScriptResult {
  loaded: boolean;
  errorMessage?: string;
}

interface OpenEntriSetupResult {
  opened: boolean;
  errorMessage?: string;
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
const ENTRI_SCRIPT_TIMEOUT_MS = 10000;
const ENTRI_UNAVAILABLE_MESSAGE =
  "Domain verification tool unavailable — try again later.";

// Fetch JWT token from server-side edge function
async function fetchEntriToken(): Promise<{
  token: string;
  applicationId: string;
} | null> {
  try {
    const { data, error } = await supabase.functions.invoke("entri-get-token");

    if (error) {
      console.error("Error fetching Entri token:", error);
      return null;
    }

    if (data?.token) {
      return {
        token: data.token,
        applicationId: data.applicationId || ENTRI_APPLICATION_ID,
      };
    }

    return null;
  } catch (err) {
    console.error("Failed to fetch Entri token:", err);
    return null;
  }
}

export const useEntriConnect = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Load Entri script dynamically
  const loadEntriScript =
    useCallback(async (): Promise<LoadEntriScriptResult> => {
      if (window.entri) {
        setIsScriptLoaded(true);
        setScriptError(null);
        return { loaded: true };
      }

      if (!emailDomainsConfig.isEntriConfigured()) {
        const errorMessage =
          "Entri integration not configured. Please contact support.";
        setIsScriptLoaded(false);
        setScriptError(errorMessage);
        return { loaded: false, errorMessage };
      }

      return new Promise((resolve) => {
        const existingScript = document.querySelector(
          `script[src="${ENTRI_SCRIPT_URL}"]`,
        ) as HTMLScriptElement | null;
        const script = existingScript ?? document.createElement("script");
        let settled = false;
        let timeoutId: number | null = null;

        const cleanup = () => {
          script.removeEventListener("load", handleLoad);
          script.removeEventListener("error", handleError);
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
        };

        const finalize = (loaded: boolean, errorMessage?: string) => {
          if (settled) {
            return;
          }

          settled = true;
          cleanup();

          if (loaded) {
            script.dataset.entriLoaded = "true";
            setIsScriptLoaded(true);
            setScriptError(null);
            resolve({ loaded: true });
            return;
          }

          if (!existingScript && script.parentNode) {
            script.parentNode.removeChild(script);
          }

          setIsScriptLoaded(false);
          setScriptError(errorMessage ?? ENTRI_UNAVAILABLE_MESSAGE);
          resolve({
            loaded: false,
            errorMessage: errorMessage ?? ENTRI_UNAVAILABLE_MESSAGE,
          });
        };

        const handleLoad = () => {
          if (window.entri) {
            finalize(true);
            return;
          }

          finalize(false, ENTRI_UNAVAILABLE_MESSAGE);
        };

        const handleError = () => {
          finalize(false, ENTRI_UNAVAILABLE_MESSAGE);
        };

        if (existingScript?.dataset.entriLoaded === "true" && window.entri) {
          finalize(true);
          return;
        }

        script.addEventListener("load", handleLoad);
        script.addEventListener("error", handleError);
        timeoutId = window.setTimeout(() => {
          finalize(false, ENTRI_UNAVAILABLE_MESSAGE);
        }, ENTRI_SCRIPT_TIMEOUT_MS);

        if (!existingScript) {
          script.src = ENTRI_SCRIPT_URL;
          script.async = true;
          script.crossOrigin = "anonymous";
          document.head.appendChild(script);
        }
      });
    }, []);

  const normalizeDomain = useCallback((value: string) => {
    return value
      .trim()
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, "");
  }, []);

  /**
   * Open Entri setup modal for automatic DNS configuration
   */
  const openEntriSetup = useCallback(
    async (
      domain: string,
      accountId: string,
      dnsRecords?: EntriDnsRecord[],
      onSuccess?: () => void,
      onCancel?: () => void,
      onClose?: () => void,
    ): Promise<OpenEntriSetupResult> => {
      setIsLoading(true);
      setScriptError(null);

      let didComplete = false;

      try {
        const loadResult = await loadEntriScript();
        if (!loadResult.loaded || !window.entri) {
          return {
            opened: false,
            errorMessage: loadResult.errorMessage ?? ENTRI_UNAVAILABLE_MESSAGE,
          };
        }

        if (!emailDomainsConfig.isEntriConfigured()) {
          const errorMessage =
            "Entri integration not configured. Please contact support.";
          setScriptError(errorMessage);
          return { opened: false, errorMessage };
        }

        const normalizedDomain = normalizeDomain(domain);

        // SAFETY: Abort if no DNS records from backend
        // We NEVER use fallback records - they could disrupt existing email
        if (!dnsRecords || dnsRecords.length === 0) {
          setIsLoading(false);
          return {
            opened: false,
            errorMessage:
              "Unable to retrieve DNS records. Please use manual setup.",
          };
        }

        // SAFETY: Strip any DMARC or root-level records before sending to Entri
        // We NEVER auto-configure root-domain email policy
        const safeRecords = dnsRecords.filter((r) => {
          const host = r.host.toLowerCase();
          // Block DMARC records
          if (host === "_dmarc" || host.startsWith("_dmarc.")) {
            return false;
          }
          // Block root-level records (@ or empty host)
          if (host === "@" || host === "") {
            return false;
          }
          return true;
        });

        // SAFETY: Verify we still have required subdomain records after filtering
        const hasDkim = safeRecords.some((r) => r.host.includes("domainkey"));
        const hasMxOrSpf = safeRecords.some(
          (r) =>
            r.type === "MX" || (r.type === "TXT" && r.value.includes("spf")),
        );

        if (!hasDkim || !hasMxOrSpf) {
          setIsLoading(false);
          return {
            opened: false,
            errorMessage:
              "DNS configuration incomplete. Please use manual setup.",
          };
        }

        // SAFETY: Perform silent DNS preflight check
        // If target subdomains already have records, abort to manual
        const preflightPassed = await performDnsPreflightCheck(
          normalizedDomain,
          safeRecords,
        );
        if (!preflightPassed) {
          setIsLoading(false);
          return {
            opened: false,
            errorMessage:
              "Automatic DNS setup is unavailable for this domain. Please use manual setup.",
          };
        }

        // Verify MX records have priority
        const mxRecords = safeRecords.filter((r) => r.type === "MX");
        for (const mx of mxRecords) {
          if (mx.priority === undefined) {
            console.error(`❌ MX record "${mx.host}" is missing priority!`);
          }
        }

        const records = safeRecords;

        // Fetch authenticated JWT token from server
        const tokenData = await fetchEntriToken();
        if (!tokenData) {
          setIsLoading(false);
          return {
            opened: false,
            errorMessage:
              "Failed to authenticate with the domain verification tool. Please try manual setup.",
          };
        }

        const successEventName = "onSuccess";
        const closeEventName = "onEntriClose";

        const handleCompletion = async (detail: EntriBrowserEventDetail) => {
          didComplete = true;

          const domainFromEntri = normalizeDomain(
            detail.domain || normalizedDomain,
          );
          const entriProvider = detail.provider || detail.setupType || "entri";
          const entriConnectionId =
            detail.connectionId ||
            detail.setupToken ||
            detail.lastStatus ||
            "entri-success";

          try {
            const { error } = await supabase.functions.invoke(
              "entri-domain-callback",
              {
                body: {
                  accountId,
                  domain: domainFromEntri,
                  entriConnectionId,
                  entriProvider,
                },
              },
            );

            if (error) {
              console.error("Error saving Entri connection:", error);
              toast.error(
                "DNS configured but failed to save in BloomSuite. Please refresh and try again.",
              );
              return;
            }

            toast.success(`DNS configured via ${entriProvider}! Verifying...`);
            onSuccess?.();
          } catch (err) {
            console.error("Error in Entri completion handler:", err);
            toast.error(
              "DNS configured but encountered an error saving in BloomSuite. Please refresh.",
            );
          }
        };

        const onSuccessEvent = (evt: Event) => {
          const detail = (evt as CustomEvent).detail as EntriBrowserEventDetail;
          void handleCompletion(detail);
        };

        const onCloseEvent = (evt: Event) => {
          const detail = (evt as CustomEvent).detail as EntriBrowserEventDetail;
          if (!didComplete) {
            if (detail?.success) {
              void handleCompletion(detail);
            } else {
              onCancel?.();
            }
          }

          window.removeEventListener(
            successEventName,
            onSuccessEvent as EventListener,
          );
          window.removeEventListener(
            closeEventName,
            onCloseEvent as EventListener,
          );
        };

        window.addEventListener(
          successEventName,
          onSuccessEvent as EventListener,
        );
        window.addEventListener(closeEventName, onCloseEvent as EventListener);

        // Open Entri modal with authenticated token
        window.entri.showEntri({
          applicationId: tokenData.applicationId,
          token: tokenData.token,
          dnsRecords: records,
        });
        return { opened: true };
      } catch {
        const errorMessage =
          "Domain verification tool unavailable — try again later.";
        setScriptError(errorMessage);
        return { opened: false, errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [loadEntriScript, normalizeDomain],
  );

  /**
   * Sanitize and convert backend DNS records to Entri format.
   * Enforces Resend's canonical model: DKIM CNAME only, MX with priority.
   *
   * @returns Object with sanitized records and validation result
   */
  const sanitizeAndConvertRecords = useCallback(
    (
      domain: string,
      backendRecords: Array<{
        name: string;
        type: string;
        value: string;
        priority?: number;
        purpose?: string;
      }>,
    ): { records: EntriDnsRecord[]; validation: ValidationResult } => {
      // Use the centralized sanitizer
      const { records, validation } = prepareRecordsForEntri(
        domain,
        backendRecords,
      );

      // Convert to Entri format, preserving priority
      const entriRecords: EntriDnsRecord[] = records.map((r) => {
        const entri: EntriDnsRecord = {
          type: r.type,
          host: r.host,
          value: r.value,
          ttl: r.ttl || 3600,
        };

        // Include priority for MX records
        if (r.type === "MX" && r.priority !== undefined) {
          entri.priority = r.priority;
        }

        return entri;
      });

      return { records: entriRecords, validation };
    },
    [],
  );

  /**
   * Validate Entri-format records strictly
   */
  const validateRecordsStrict = useCallback(
    (records: EntriDnsRecord[]): ValidationResult => {
      // Convert to DnsRecord format for validation
      const dnsRecords: DnsRecord[] = records.map((r) => ({
        type: r.type,
        host: r.host,
        value: r.value,
        ttl: r.ttl,
        priority: r.priority,
      }));

      return validateCanonicalRecords(dnsRecords);
    },
    [],
  );

  return {
    openEntriSetup,
    sanitizeAndConvertRecords,
    validateRecordsStrict,
    isLoading,
    isScriptLoaded,
    scriptError,
    clearScriptError: () => setScriptError(null),
    isEntriConfigured: emailDomainsConfig.isEntriConfigured(),
  };
};

/**
 * SAFETY: Silent DNS preflight check
 * Checks if target subdomains already have DNS records.
 * If ANY conflict is detected, returns false (abort auto-setup).
 * This check is invisible to the user - no technical explanations shown.
 */
async function performDnsPreflightCheck(
  domain: string,
  records: EntriDnsRecord[],
): Promise<boolean> {
  try {
    // Extract unique hosts we're about to write
    const targetHosts = new Set<string>();
    for (const r of records) {
      const host = r.host.toLowerCase();
      // Build FQDN for lookup
      let fqdn: string;
      if (host === "@" || host === "") {
        fqdn = domain;
      } else if (host.endsWith(domain)) {
        fqdn = host;
      } else {
        fqdn = `${host}.${domain}`;
      }
      targetHosts.add(fqdn);
    }
    // Check each target host for existing records
    for (const fqdn of targetHosts) {
      try {
        // Check for TXT records
        const txtResponse = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fqdn)}&type=TXT`,
          { headers: { Accept: "application/dns-json" } },
        );
        if (txtResponse.ok) {
          const txtData = await txtResponse.json();
          if (txtData.Answer && txtData.Answer.length > 0) {
            return false;
          }
        }

        // Check for CNAME records
        const cnameResponse = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fqdn)}&type=CNAME`,
          { headers: { Accept: "application/dns-json" } },
        );
        if (cnameResponse.ok) {
          const cnameData = await cnameResponse.json();
          if (cnameData.Answer && cnameData.Answer.length > 0) {
            return false;
          }
        }

        // Check for MX records (only for send subdomain)
        if (fqdn.startsWith("send.")) {
          const mxResponse = await fetch(
            `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(fqdn)}&type=MX`,
            { headers: { Accept: "application/dns-json" } },
          );
          if (mxResponse.ok) {
            const mxData = await mxResponse.json();
            if (mxData.Answer && mxData.Answer.length > 0) {
              return false;
            }
          }
        }
      } catch (lookupError) {
        // DNS lookup failed - treat as safe to proceed (no existing records detected)
      }
    }
    return true;
  } catch (error) {
    // If preflight check fails entirely, be conservative and allow manual
    console.error("🛡️ Preflight check failed, aborting auto-setup:", error);
    return false;
  }
}
