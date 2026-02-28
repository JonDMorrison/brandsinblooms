import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Plus,
  Settings,
  CheckCircle,
  Clock,
  Mail,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Wrench,
  Link2Off
} from 'lucide-react';
import { DomainConnectWizard } from '@/components/crm/settings/DomainConnectWizard';
import { EmailDomainDetails } from './EmailDomainDetails';
import { useEmailDomains, EmailDomain } from '@/hooks/useEmailDomains';
import { useEntriConnect } from '@/hooks/useEntriConnect';
import { useTenant } from '@/hooks/useTenant';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

// =========================================================
// Readiness Status Types (matches edge function)
// =========================================================

type ReadinessStatus =
  | 'CONNECTED_READY'           // DNS verified, domain is working - primary success state
  | 'ACTION_REQUIRED_DNS_MISSING'
  | 'ACTION_REQUIRED_DNS_CONFLICT'
  | 'DOMAIN_NOT_CONNECTED'
  // Legacy statuses (for backward compatibility)
  | 'READY_TO_SEND'
  | 'READY_AWAITING_PROVIDER';

interface ReadinessDisplay {
  status: ReadinessStatus;
  badge: { text: string; variant: 'green' | 'amber' | 'red' | 'gray' };
  message: string;
  subMessage?: string;
  ctaLabel?: string;
  ctaAction?: 'repair' | 'fix_conflict' | 'connect';
  showForceCheck: boolean;
}

// =========================================================
// Readiness Badge Component (strict color system)
// =========================================================

const ReadinessBadge = ({
  variant,
  children
}: {
  variant: 'green' | 'amber' | 'red' | 'gray';
  children: React.ReactNode;
}) => {
  const styles = {
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200'
  };

  return (
    <Badge className={styles[variant]}>
      {children}
    </Badge>
  );
};

// =========================================================
// Main Component
// =========================================================

export const EmailDomainsList = () => {
  const { emailDomains, loading, verifyEmailDomain, retryEmailDomain, getDomainRecords, refetch } = useEmailDomains();
  const { openEntriSetup, sanitizeAndConvertRecords, isLoading: entriLoading } = useEntriConnect();
  const { tenant } = useTenant();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(new Set());
  const [repairingDomains, setRepairingDomains] = useState<Set<string>>(new Set());

  // Rate limiting: track last check time per domain
  const [lastCheckTimes, setLastCheckTimes] = useState<Record<string, number>>({});
  const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

  // =========================================================
  // Compute Readiness Display (single source of truth)
  // =========================================================

  const getReadinessDisplay = (domain: EmailDomain): ReadinessDisplay => {
    const resendStatus = domain.resend_status as any;

    // Check for readiness object from API (new format)
    if (resendStatus?.readiness?.status) {
      const r = resendStatus.readiness;
      return mapReadinessToDisplay(r.status, r.message, r.subMessage, r.cta, domain);
    }

    // Fallback: compute from legacy fields
    return computeReadinessFromLegacy(domain, resendStatus);
  };

  const mapReadinessToDisplay = (
    status: ReadinessStatus,
    message: string,
    subMessage?: string,
    cta?: string | null,
    domain?: EmailDomain
  ): ReadinessDisplay => {
    switch (status) {
      case 'CONNECTED_READY':
        // Primary success state - confident, celebratory
        return {
          status,
          badge: { text: 'Connected', variant: 'green' },
          message: message || 'Your email domain is connected and ready to use.',
          subMessage,
          showForceCheck: false
        };
      // Legacy: still support READY_TO_SEND for backward compatibility
      case 'READY_TO_SEND':
        return {
          status: 'CONNECTED_READY',
          badge: { text: 'Connected', variant: 'green' },
          message: message || 'Your email domain is connected and ready to use.',
          subMessage,
          showForceCheck: false
        };
      // Legacy: still support READY_AWAITING_PROVIDER - map to CONNECTED_READY
      // since DNS is correct, user should feel DONE
      case 'READY_AWAITING_PROVIDER':
        return {
          status: 'CONNECTED_READY',
          badge: { text: 'Connected', variant: 'green' },
          message: 'Your email domain is connected and ready to use.',
          subMessage: undefined, // Hide provider status from user
          showForceCheck: false
        };
      case 'ACTION_REQUIRED_DNS_MISSING':
        return {
          status,
          badge: { text: 'Action Required', variant: 'red' },
          message,
          subMessage,
          ctaLabel: cta || 'Repair DNS',
          ctaAction: 'repair',
          showForceCheck: false
        };
      case 'ACTION_REQUIRED_DNS_CONFLICT':
        return {
          status,
          badge: { text: 'DNS Conflict', variant: 'red' },
          message,
          subMessage,
          ctaLabel: cta || 'Fix DNS Conflict',
          ctaAction: 'fix_conflict',
          showForceCheck: false
        };
      case 'DOMAIN_NOT_CONNECTED':
      default:
        return {
          status,
          badge: { text: 'Not Connected', variant: 'gray' },
          message: message || "Domain isn't connected to BloomSuite yet.",
          ctaLabel: cta || 'Connect DNS',
          ctaAction: 'connect',
          showForceCheck: false
        };
    }
  };

  const computeReadinessFromLegacy = (domain: EmailDomain, resendStatus: any): ReadinessDisplay => {
    // Check DNS verification status FIRST
    const records = resendStatus?.records || [];
    const allDnsVerified = records.length > 0 && records.every((r: any) => r.dns_verified || r.status === 'verified');
    const resendVerified = resendStatus?.status === 'verified' || resendStatus?.dkim_verified;

    // Check for paused status (reputation issues) - show connected but with warning
    if (domain.status === 'paused') {
      return {
        status: 'CONNECTED_READY',
        badge: { text: 'Paused', variant: 'amber' },
        message: 'Domain is currently paused.',
        subMessage: 'Contact support for assistance.',
        showForceCheck: false
      };
    }

    // If DNS is verified OR domain is active, show CONNECTED_READY - user should feel DONE
    if (allDnsVerified || resendVerified || domain.status === 'active' || resendStatus?.verification_phase === 'dns_present_waiting_provider') {
      return mapReadinessToDisplay(
        'CONNECTED_READY',
        'Your email domain is connected and ready to use.'
      );
    }

    // Check for conflicts (highest priority error after checking active status)
    if (resendStatus?.dns_conflict_detected) {
      return mapReadinessToDisplay(
        'ACTION_REQUIRED_DNS_CONFLICT',
        'A conflicting DNS record is blocking email setup.',
        domain.is_entri_managed ? 'We can fix this automatically.' : 'Please remove the conflicting CNAME record.',
        domain.is_entri_managed ? 'Fix DNS Conflict' : undefined
      );
    }

    // Domain has no DNS configured and isn't connected via any method
    if (!domain.is_entri_managed && !domain.entri_connection_id && !domain.resend_domain_id) {
      return mapReadinessToDisplay(
        'DOMAIN_NOT_CONNECTED',
        "Domain isn't connected to BloomSuite yet.",
        'Set up automatic DNS configuration to get started.',
        'Connect DNS'
      );
    }

    // DNS not verified - action required
    if (domain.status === 'failed') {
      return mapReadinessToDisplay(
        'ACTION_REQUIRED_DNS_MISSING',
        'Domain verification failed.',
        'Click Retry to try again.',
        'Retry'
      );
    }

    // Domain is pending/warming up - still in progress
    if (domain.status === 'pending_dns' || domain.status === 'verifying') {
      return {
        status: 'CONNECTED_READY',
        badge: { text: 'Verifying', variant: 'amber' },
        message: 'DNS verification in progress.',
        subMessage: 'This may take a few minutes.',
        showForceCheck: true
      };
    }

    if (domain.status === 'warming_up') {
      return {
        status: 'CONNECTED_READY',
        badge: { text: 'Warming Up', variant: 'amber' },
        message: 'Your domain is connected and warming up.',
        subMessage: 'Sending limits will increase over time.',
        showForceCheck: false
      };
    }

    return mapReadinessToDisplay(
      'ACTION_REQUIRED_DNS_MISSING',
      'DNS records not visible yet.',
      domain.is_entri_managed ? 'We can repair automatically.' : 'Please check your DNS configuration.',
      domain.is_entri_managed ? 'Repair DNS' : undefined
    );
  };

  // =========================================================
  // Rate Limiting for Force Check
  // =========================================================

  const canForceCheck = (domainId: string): boolean => {
    const lastCheck = lastCheckTimes[domainId] || 0;
    return Date.now() - lastCheck > RATE_LIMIT_MS;
  };

  const getTimeUntilNextCheck = (domainId: string): number => {
    const lastCheck = lastCheckTimes[domainId] || 0;
    const remaining = RATE_LIMIT_MS - (Date.now() - lastCheck);
    return Math.max(0, Math.ceil(remaining / 1000));
  };

  // =========================================================
  // Handlers
  // =========================================================

  const handleVerifyDomain = async (domainId: string, isRetry = false) => {
    // Rate limit check for non-retry operations
    if (!isRetry && !canForceCheck(domainId)) {
      const remaining = getTimeUntilNextCheck(domainId);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      toast.info(`Please wait ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s before checking again`);
      return;
    }

    try {
      setVerifyingDomains(prev => new Set(prev).add(domainId));
      setLastCheckTimes(prev => ({ ...prev, [domainId]: Date.now() }));

      if (isRetry) {
        await retryEmailDomain(domainId);
      } else {
        await verifyEmailDomain(domainId);
      }
    } catch (error: any) {
      console.error('Error verifying domain:', error);
    } finally {
      setVerifyingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domainId);
        return newSet;
      });
    }
  };

  const handleRepairDomain = async (domain: EmailDomain) => {
    if (!tenant?.id) return;

    try {
      setRepairingDomains(prev => new Set(prev).add(domain.id));

      const records = await getDomainRecords(domain.id);

      if (!records || records.length === 0) {
        toast.error('No DNS records found. Please delete and re-add this domain.');
        return;
      }

      const backendRecords = records.map(r => ({
        name: r.name,
        type: r.type,
        value: r.value,
        priority: (r as any).priority,
        purpose: r.purpose
      }));

      const { records: entriRecords, validation } = sanitizeAndConvertRecords(domain.domain, backendRecords);

      if (!validation.valid) {
        toast.error(`Invalid DNS configuration: ${validation.errors.join(', ')}`);
        return;
      }

      await openEntriSetup(
        domain.domain,
        tenant.id,
        entriRecords,
        async () => {
          toast.success('DNS records applied! Running verification...');
          setTimeout(async () => {
            try {
              await verifyEmailDomain(domain.id);
              refetch();
            } catch (e) {
              console.error('Post-repair verification failed:', e);
            }
          }, 2000);
        },
        () => {
          toast.info('DNS repair cancelled');
        }
      );
    } catch (error: any) {
      console.error('Error repairing domain:', error);
      toast.error(error.message || 'Failed to repair domain');
    } finally {
      setRepairingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domain.id);
        return newSet;
      });
    }
  };

  const getLastCheckedText = (domain: EmailDomain) => {
    if (!domain.last_verify_attempt_at) return null;
    try {
      return `Checked ${formatDistanceToNow(new Date(domain.last_verify_attempt_at), { addSuffix: true })}`;
    } catch {
      return null;
    }
  };

  const getStatusIcon = (display: ReadinessDisplay) => {
    switch (display.badge.variant) {
      case 'green':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'amber':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'red':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'gray':
        return <Link2Off className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  // =========================================================
  // Render
  // =========================================================

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl">Email Domains</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure domains for sending emails with your brand
            </p>
          </div>
          <Button onClick={() => setShowWizard(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Domain
          </Button>
        </CardHeader>
        <CardContent>
          {emailDomains.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-medium mb-1">No domains configured yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Add your domain to send emails from your own address and improve deliverability.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {emailDomains.map((domain) => {
                const display = getReadinessDisplay(domain);
                const lastChecked = getLastCheckedText(domain);
                const isVerifying = verifyingDomains.has(domain.id);
                const isRepairing = repairingDomains.has(domain.id);
                const isFailed = domain.status === 'failed';
                const canCheck = canForceCheck(domain.id);

                return (
                  <div
                    key={domain.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Status Icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        display.badge.variant === 'green' ? 'bg-green-100' :
                        display.badge.variant === 'red' ? 'bg-red-100' :
                        display.badge.variant === 'gray' ? 'bg-gray-100' : 'bg-amber-100'
                      }`}>
                        {getStatusIcon(display)}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Domain name + Single Badge */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-medium truncate">{domain.domain}</p>
                          <ReadinessBadge variant={display.badge.variant}>
                            {display.badge.text}
                          </ReadinessBadge>
                          {domain.is_sandbox && (
                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">Sandbox</Badge>
                          )}
                        </div>

                        {/* Single Message */}
                        <p className="text-sm text-muted-foreground">
                          {display.message}
                        </p>

                        {/* Sub-message (if any) */}
                        {display.subMessage && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {display.subMessage}
                          </p>
                        )}

                        {/* Last checked timestamp */}
                        {lastChecked && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {lastChecked}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions - Single CTA pattern */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {/* Primary CTA Button (red actions) */}
                      {display.ctaAction && domain.is_entri_managed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (display.ctaAction === 'repair' || display.ctaAction === 'fix_conflict') {
                              handleRepairDomain(domain);
                            }
                          }}
                          disabled={isRepairing || entriLoading}
                          className={`flex items-center gap-2 ${
                            display.badge.variant === 'red'
                              ? 'border-red-400 text-red-700 hover:bg-red-50'
                              : ''
                          }`}
                        >
                          {isRepairing ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wrench className="w-4 h-4" />
                          )}
                          {isRepairing ? 'Fixing...' : display.ctaLabel}
                        </Button>
                      )}

                      {/* Retry button for failed domains */}
                      {isFailed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifyDomain(domain.id, true)}
                          disabled={isVerifying}
                          className="flex items-center gap-2"
                        >
                          {isVerifying ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          {isVerifying ? 'Retrying...' : 'Retry'}
                        </Button>
                      )}

                      {/* Check Status button (for awaiting provider) */}
                      {display.showForceCheck && !isFailed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifyDomain(domain.id)}
                          disabled={isVerifying || !canCheck}
                          className="flex items-center gap-2"
                        >
                          {isVerifying ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          {isVerifying ? 'Checking...' : canCheck ? 'Check Status' : 'Checked'}
                        </Button>
                      )}

                      {/* Details button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDomain(domain.id)}
                        className="flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DomainConnectWizard
        open={showWizard}
        onClose={() => {
          setShowWizard(false);
          refetch();
        }}
      />

      {selectedDomain && (
        <EmailDomainDetails
          domainId={selectedDomain}
          open={!!selectedDomain}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedDomain(null);
              refetch();
            }
          }}
        />
      )}
    </>
  );
};
