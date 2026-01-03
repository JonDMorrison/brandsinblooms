import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Plus, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Mail,
  RefreshCw,
  RotateCcw,
  XCircle,
  Wrench
} from 'lucide-react';
import { DomainConnectWizard } from '@/components/crm/settings/DomainConnectWizard';
import { EmailDomainDetails } from './EmailDomainDetails';
import { useEmailDomains, EmailDomain } from '@/hooks/useEmailDomains';
import { useEntriConnect, EntriDnsRecord } from '@/hooks/useEntriConnect';
import { useTenant } from '@/hooks/useTenant';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export const EmailDomainsList = () => {
  const { emailDomains, loading, verifyEmailDomain, retryEmailDomain, getDomainRecords, refetch } = useEmailDomains();
  const { openEntriSetup, sanitizeAndConvertRecords, isLoading: entriLoading } = useEntriConnect();
  const { tenant } = useTenant();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(new Set());
  const [repairingDomains, setRepairingDomains] = useState<Set<string>>(new Set());

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  const getVerificationProgress = (domain: EmailDomain) => {
    const resendStatus = domain.resend_status as any;
    if (!resendStatus?.records || !Array.isArray(resendStatus.records)) {
      return { verified: 0, total: 0, percentage: 0 };
    }
    
    const total = resendStatus.records.length;
    const verified = resendStatus.records.filter((r: any) => r.status === 'verified').length;
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;
    
    return { verified, total, percentage };
  };

  const getStatusBadge = (domain: EmailDomain) => {
    const { verified, total, percentage } = getVerificationProgress(domain);
    
    if (domain.status === 'active') {
      return <Badge className="bg-green-100 text-green-800 border-green-200">✓ Active</Badge>;
    }
    if (domain.status === 'failed' || domain.status === 'error') {
      return <Badge variant="destructive">Action Required</Badge>;
    }
    
    // Show progress for pending states
    if (total > 0) {
      if (verified === total) {
        return <Badge className="bg-green-100 text-green-800 border-green-200">✓ Verified</Badge>;
      }
      return (
        <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
          {verified}/{total} Verified
        </Badge>
      );
    }
    
    return <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">Setting Up</Badge>;
  };

  const getProviderBadge = (domain: EmailDomain) => {
    if (domain.is_sandbox) {
      return <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">Sandbox</Badge>;
    }
    return null;
  };

  const handleVerifyDomain = async (domainId: string, isRetry = false) => {
    try {
      setVerifyingDomains(prev => new Set(prev).add(domainId));
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

  const getLastCheckedText = (domain: EmailDomain) => {
    if (!domain.last_verify_attempt_at) return null;
    try {
      return `Checked ${formatDistanceToNow(new Date(domain.last_verify_attempt_at), { addSuffix: true })}`;
    } catch {
      return null;
    }
  };

  const getPendingRecords = (domain: EmailDomain): { 
    pending: string[]; 
    verified: string[]; 
    dnsVerifiedPending: string[];
    hasConflict: boolean;
    conflictHostnames: string[];
  } => {
    const pending: string[] = [];
    const verified: string[] = [];
    const dnsVerifiedPending: string[] = []; // DNS verified but Resend pending
    let hasConflict = false;
    const conflictHostnames: string[] = [];
    
    // Parse from resend_status.records array (the actual Resend API format)
    const resendStatus = domain.resend_status as any;
    
    // Check for DNS conflict at domain level
    if (resendStatus?.dns_conflict_detected) {
      hasConflict = true;
      if (resendStatus?.dns_conflict_details && Array.isArray(resendStatus.dns_conflict_details)) {
        for (const detail of resendStatus.dns_conflict_details) {
          conflictHostnames.push(detail.hostname);
        }
      }
    }
    
    if (resendStatus?.records && Array.isArray(resendStatus.records)) {
      for (const rec of resendStatus.records) {
        const label = rec.record || rec.type || 'Unknown';
        const fqdn = rec.fqdn_queried || rec.name;
        
        if (rec.status === 'verified') {
          verified.push(label);
        } else if (rec.has_conflict) {
          // Record has a conflict - don't show as pending, show conflict instead
          hasConflict = true;
          if (fqdn && !conflictHostnames.includes(fqdn)) {
            conflictHostnames.push(fqdn);
          }
        } else if (rec.dns_verified) {
          // DNS is correct but Resend hasn't confirmed yet
          dnsVerifiedPending.push(`${label} (${fqdn})`);
        } else {
          pending.push(`${label} (${fqdn})`);
        }
      }
    }
    
    return { pending, verified, dnsVerifiedPending, hasConflict, conflictHostnames };
  };

  // Repair domain by re-opening Entri with current DNS records
  const handleRepairDomain = async (domain: EmailDomain) => {
    if (!tenant?.id) return;
    
    try {
      setRepairingDomains(prev => new Set(prev).add(domain.id));
      
      // Fetch current DNS records from database
      const records = await getDomainRecords(domain.id);
      
      if (!records || records.length === 0) {
        toast.error('No DNS records found. Please delete and re-add this domain.');
        return;
      }
      
      // Convert to Entri format
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
      
      console.log('🔧 Repairing domain with Entri:', domain.domain, entriRecords);
      
      // Open Entri to apply records
      await openEntriSetup(
        domain.domain,
        tenant.id,
        entriRecords,
        async () => {
          toast.success('DNS records applied! Running verification...');
          // Trigger verification after Entri completes
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
                const lastChecked = getLastCheckedText(domain);
                const { pending: pendingRecords, verified: verifiedRecords, dnsVerifiedPending, hasConflict, conflictHostnames } = getPendingRecords(domain);
                const isVerifying = verifyingDomains.has(domain.id);
                const isRepairing = repairingDomains.has(domain.id);
                const isFailed = domain.status === 'failed';
                const needsRepair = domain.status === 'pending_dns' && (pendingRecords.length > 0 || hasConflict);
                const isDnsVerifiedAwaitingResend = dnsVerifiedPending.length > 0 && pendingRecords.length === 0 && !hasConflict;

                const { verified: verifiedCount, total: totalCount, percentage } = getVerificationProgress(domain);

                return (
                  <div
                    key={domain.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        domain.status === 'active' ? 'bg-green-100' :
                        domain.status === 'failed' ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                        {getStatusIcon(domain.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-medium truncate">{domain.domain}</p>
                          {getStatusBadge(domain)}
                          {getProviderBadge(domain)}
                        </div>
                        
                        {/* Progress bar for non-active domains */}
                        {domain.status !== 'active' && totalCount > 0 && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[200px]">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  percentage === 100 ? 'bg-green-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{percentage}%</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {lastChecked && <span>{lastChecked}</span>}
                          {domain.verify_attempts !== undefined && domain.verify_attempts > 0 && domain.status !== 'active' && (
                            <span>Attempts: {domain.verify_attempts}/10</span>
                          )}
                        </div>

                        {/* Consolidated status display for non-active domains */}
                        {domain.status !== 'active' && (
                          <div className="mt-2 space-y-1">
                            {/* DNS Conflict - Red, highest priority */}
                            {hasConflict && (
                              <div className="flex items-start gap-2 text-xs">
                                <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-red-700">
                                  <strong>Action required:</strong> DNS conflict detected at {conflictHostnames.join(', ')}
                                </span>
                              </div>
                            )}

                            {/* Missing DNS records - Red */}
                            {pendingRecords.length > 0 && !hasConflict && (
                              <div className="flex items-start gap-2 text-xs">
                                <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-red-700">
                                  <strong>Missing:</strong> {pendingRecords.length} record{pendingRecords.length > 1 ? 's' : ''} not found in DNS
                                </span>
                              </div>
                            )}

                            {/* Awaiting provider verification - Amber */}
                            {dnsVerifiedPending.length > 0 && !hasConflict && (
                              <div className="flex items-start gap-2 text-xs">
                                <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <span className="text-amber-700">
                                  <strong>Waiting:</strong> {dnsVerifiedPending.length} record{dnsVerifiedPending.length > 1 ? 's' : ''} configured, awaiting provider
                                </span>
                              </div>
                            )}

                            {/* Verified records - Green */}
                            {verifiedRecords.length > 0 && (
                              <div className="flex items-start gap-2 text-xs">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-green-700">
                                  <strong>Complete:</strong> {verifiedRecords.length} record{verifiedRecords.length > 1 ? 's' : ''} verified
                                </span>
                              </div>
                            )}

                            {/* Show helpful message when all DNS is correct but waiting */}
                            {isDnsVerifiedAwaitingResend && !hasConflict && pendingRecords.length === 0 && (
                              <p className="text-xs text-amber-600 mt-1 italic">
                                DNS is correctly configured. Provider verification can take a few hours.
                              </p>
                            )}

                            {/* Error message */}
                            {domain.last_verify_error && (
                              <p className="text-xs text-red-600 mt-1 line-clamp-1">
                                {domain.last_verify_error}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {domain.status !== 'active' && (
                        <>
                          {/* Repair/Fix Conflict button - for pending_dns with missing records or conflicts */}
                          {needsRepair && domain.is_entri_managed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRepairDomain(domain)}
                              disabled={isRepairing || entriLoading}
                              className={`flex items-center gap-2 ${
                                hasConflict 
                                  ? 'border-red-400 text-red-700 hover:bg-red-50' 
                                  : 'border-amber-400 text-amber-700 hover:bg-amber-50'
                              }`}
                            >
                              {isRepairing ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Wrench className="w-4 h-4" />
                              )}
                              {isRepairing ? 'Fixing...' : hasConflict ? 'Fix DNS Conflict' : 'Repair DNS'}
                            </Button>
                          )}
                          
                          {isFailed ? (
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
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerifyDomain(domain.id)}
                              disabled={isVerifying}
                              className="flex items-center gap-2"
                            >
                              {isVerifying ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              {isVerifying ? 'Verifying...' : 'Verify Now'}
                            </Button>
                          )}
                        </>
                      )}
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
