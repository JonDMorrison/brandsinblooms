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
  XCircle
} from 'lucide-react';
import { DomainConnectWizard } from '@/components/crm/settings/DomainConnectWizard';
import { EmailDomainDetails } from './EmailDomainDetails';
import { useEmailDomains, EmailDomain } from '@/hooks/useEmailDomains';
import { formatDistanceToNow } from 'date-fns';

export const EmailDomainsList = () => {
  const { emailDomains, loading, verifyEmailDomain, retryEmailDomain, refetch } = useEmailDomains();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(new Set());

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

  const getStatusBadge = (domain: EmailDomain) => {
    switch (domain.status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'verifying':
        return <Badge className="bg-amber-100 text-amber-800">Verifying</Badge>;
      case 'pending_dns':
        return <Badge variant="outline" className="border-amber-400 text-amber-700">Pending DNS</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
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

  const getFailedChecks = (domain: EmailDomain) => {
    if (!domain.resend_status) return [];
    const failed: string[] = [];
    if (domain.resend_status.dkim_verified === false) failed.push('DKIM');
    if (domain.resend_status.spf_verified === false) failed.push('SPF');
    if (domain.resend_status.return_path_verified === false) failed.push('Return Path');
    return failed;
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
                const failedChecks = getFailedChecks(domain);
                const isVerifying = verifyingDomains.has(domain.id);
                const isFailed = domain.status === 'failed';

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
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {lastChecked && <span>{lastChecked}</span>}
                          {domain.verify_attempts !== undefined && domain.verify_attempts > 0 && domain.status !== 'active' && (
                            <span>Attempts: {domain.verify_attempts}/10</span>
                          )}
                          {domain.report_email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {domain.report_email}
                            </div>
                          )}
                        </div>

                        {/* Show failed checks */}
                        {failedChecks.length > 0 && domain.status !== 'active' && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span className="text-xs text-amber-700">
                              Missing: {failedChecks.join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Show error message */}
                        {domain.last_verify_error && domain.status !== 'active' && (
                          <p className="text-xs text-red-600 mt-1 line-clamp-1">
                            {domain.last_verify_error}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {domain.status !== 'active' && (
                        isFailed ? (
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
                        )
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
