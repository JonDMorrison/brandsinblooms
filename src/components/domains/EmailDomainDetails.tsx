import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Mail, 
  RefreshCw,
  Edit,
  Save,
  X,
  TestTube,
  Trash2,
  ChevronDown,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useEmailDomains, EmailDomain, EmailDnsRecord, EmailDnsCheck } from '@/hooks/useEmailDomains';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EmailDomainDetailsProps {
  domainId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EmailDomainDetails = ({ domainId, open, onOpenChange }: EmailDomainDetailsProps) => {
  const { 
    emailDomains, 
    getDomainRecords, 
    getDomainChecks, 
    verifyEmailDomain,
    updateEmailDomain,
    deleteEmailDomain,
    refetch
  } = useEmailDomains();
  
  const [domain, setDomain] = useState<EmailDomain | null>(null);
  const [records, setRecords] = useState<EmailDnsRecord[]>([]);
  const [checks, setChecks] = useState<EmailDnsCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingReportEmail, setEditingReportEmail] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(false);

  // Sync domain from hook whenever emailDomains updates
  useEffect(() => {
    if (domainId && emailDomains.length > 0) {
      const domainData = emailDomains.find(d => d.id === domainId);
      if (domainData) {
        setDomain(domainData);
        setReportEmail(domainData.report_email || '');
      }
    }
  }, [domainId, emailDomains]);

  useEffect(() => {
    if (domainId && open) {
      loadDomainData();
    }
  }, [domainId, open]);

  const loadDomainData = async () => {
    try {
      setLoading(true);
      const [recordsData, checksData] = await Promise.all([
        getDomainRecords(domainId),
        getDomainChecks(domainId)
      ]);
      setRecords(recordsData);
      setChecks(checksData);
    } catch (error) {
      console.error('Error loading domain data:', error);
      toast.error('Failed to load domain details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleVerify = async () => {
    try {
      setVerifying(true);
      const result = await verifyEmailDomain(domainId);
      
      if (result.allVerified) {
        toast.success('Domain verification completed successfully!');
      } else {
        toast.warning('Some DNS records are not yet configured correctly.');
      }
      
      await loadDomainData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify domain');
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveReportEmail = async () => {
    if (!domain) return;
    
    try {
      await updateEmailDomain(domainId, { 
        report_email: reportEmail.trim() || null 
      });
      
      setEditingReportEmail(false);
      toast.success('Report email updated successfully');
      await loadDomainData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update report email');
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteEmailDomain(domainId);
      toast.success('Domain deleted successfully');
      onOpenChange(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete domain');
    } finally {
      setDeleting(false);
    }
  };

  const getRecordStatus = (record: EmailDnsRecord) => {
    const latestCheck = checks
      .filter(c => c.check_name === record.purpose)
      .sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];
    
    return latestCheck?.ok;
  };

  const formatRecordValue = (value: string, maxLength: number = 60) => {
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  };

  // Get evidence panel data from resend_status
  const getEvidenceData = () => {
    const resendStatus = domain?.resend_status as any;
    
    return {
      directDns: resendStatus?.direct_dns || { verified: false, checks: [] },
      provider: resendStatus?.provider || {
        status: resendStatus?.status || 'unknown',
        dkim_verified: resendStatus?.dkim_verified || false,
        spf_verified: resendStatus?.spf_verified || false,
        return_path_verified: resendStatus?.return_path_verified || false,
        last_checked_at: domain?.last_verify_attempt_at
      },
      conflicts: resendStatus?.conflicts || {
        detected: resendStatus?.dns_conflict_detected || false,
        details: resendStatus?.dns_conflict_details || []
      },
      records: resendStatus?.records || []
    };
  };

  const evidence = getEvidenceData();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        {!domain ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {domain.domain}
                <Badge 
                  variant={domain.status === 'active' ? 'default' : 'outline'}
                  className={domain.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                >
                  {domain.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Domain Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Domain</Label>
                  <p className="text-sm">{domain.domain}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{domain.status}</p>
                    {domain.is_sandbox && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 flex items-center gap-1">
                        <TestTube className="w-3 h-3" />
                        SANDBOX
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Environment</Label>
                  <p className="text-sm">{domain.env === 'dev' ? 'Development' : 'Production'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="text-sm">{new Date(domain.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* DMARC Report Email */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">DMARC Report Emails</Label>
                  {!editingReportEmail && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingReportEmail(true)}
                      className="flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                  )}
                </div>

                {editingReportEmail ? (
                  <div className="flex gap-2">
                    <Input
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="reports@yourdomain.com"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="sm" onClick={handleSaveReportEmail}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingReportEmail(false);
                        setReportEmail(domain.report_email || '');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {domain.report_email ? (
                      <p>Reports sent to: <span className="font-medium">{domain.report_email}</span> and <span className="font-medium">dmarc@bloomsuite.app</span></p>
                    ) : (
                      <p>Reports sent to: <span className="font-medium">dmarc@bloomsuite.app</span> (default only)</p>
                    )}
                  </div>
                )}
              </div>

              {/* DNS Records */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">DNS Records</h3>
                  <Button
                    variant="outline"
                    onClick={handleVerify}
                    disabled={verifying || loading}
                    className="flex items-center gap-2"
                  >
                    {verifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {verifying ? 'Verifying...' : 'Verify DNS'}
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {records.map((record) => {
                      const status = getRecordStatus(record);
                      
                      return (
                        <div key={record.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="uppercase">
                                {record.purpose}
                              </Badge>
                              <Badge variant="outline">
                                {record.type}
                              </Badge>
                              {record.applied_automatically && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Auto-Applied
                                </Badge>
                              )}
                              {status !== undefined && (
                                <div className="flex items-center gap-1">
                                  {status ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                  )}
                                  <span className={`text-xs ${status ? 'text-green-600' : 'text-red-600'}`}>
                                    {status ? 'Verified' : 'Not Found'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Name</Label>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
                                  {record.name}
                                </code>
                                <Button variant="ghost" size="sm" onClick={() => handleCopyToClipboard(record.name)}>
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs text-muted-foreground">Value</Label>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-muted px-2 py-1 rounded flex-1 break-all">
                                  {formatRecordValue(record.value)}
                                </code>
                                <Button variant="ghost" size="sm" onClick={() => handleCopyToClipboard(record.value)}>
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                              {record.value.length > 60 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Click copy to get the full value
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Technical Details (Evidence Panel) - Collapsed by default */}
              <Collapsible open={technicalDetailsOpen} onOpenChange={setTechnicalDetailsOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={`w-4 h-4 transition-transform ${technicalDetailsOpen ? 'rotate-180' : ''}`} />
                  Show technical details
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  {/* Public DNS Check Results */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">Public DNS Check Results</h4>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      {evidence.records.length > 0 ? (
                        evidence.records.map((record: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {record.dns_verified || record.status === 'verified' ? (
                              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            )}
                            <code className="font-mono">{record.type || record.record}</code>
                            <span className="text-muted-foreground truncate">{record.fqdn_queried || record.name}</span>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {record.status}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No DNS records data available</p>
                      )}
                    </div>
                  </div>

                  {/* Provider Status */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">Provider Status</h4>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>Resend Status:</span>
                        <Badge variant="outline">{evidence.provider.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>DKIM:</span>
                        {evidence.provider.dkim_verified ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>SPF:</span>
                        {evidence.provider.spf_verified ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Return Path:</span>
                        {evidence.provider.return_path_verified ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                      {domain.last_verify_attempt_at && (
                        <p className="text-xs text-muted-foreground pt-2">
                          Last checked: {formatDistanceToNow(new Date(domain.last_verify_attempt_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Conflicts */}
                  {evidence.conflicts.detected && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase text-red-600">Conflicts Detected</h4>
                      <div className="bg-red-50 rounded-lg p-3 space-y-1">
                        {evidence.conflicts.details.map((conflict: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-red-700">{conflict.hostname}</p>
                              <p className="text-red-600">{conflict.conflictType}</p>
                              {conflict.cnameTarget && (
                                <p className="text-red-600 text-xs">CNAME points to: {conflict.cnameTarget}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Setup/Sandbox notices */}
              {domain.status !== 'active' && !domain.is_sandbox && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <div className="flex gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">Setup In Progress</p>
                      <p>
                        DNS configuration is being verified. This may take up to 72 hours depending on DNS propagation.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {domain.is_sandbox && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex gap-2">
                    <TestTube className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Sandbox Domain</p>
                      <p>
                        This is a test domain with DNS records applied automatically. 
                        Perfect for testing email functionality without manual DNS configuration.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      Delete Domain
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {domain.domain}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this domain and all its DNS records. 
                        You will no longer be able to send emails from this domain.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
