
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Mail, 
  RefreshCw,
  Edit,
  Save,
  X,
  TestTube
} from 'lucide-react';
import { useEmailDomains, EmailDomain, EmailDnsRecord, EmailDnsCheck } from '@/hooks/useEmailDomains';
import { toast } from 'sonner';

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
    updateEmailDomain 
  } = useEmailDomains();
  
  const [domain, setDomain] = useState<EmailDomain | null>(null);
  const [records, setRecords] = useState<EmailDnsRecord[]>([]);
  const [checks, setChecks] = useState<EmailDnsCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [editingReportEmail, setEditingReportEmail] = useState(false);
  const [reportEmail, setReportEmail] = useState('');

  useEffect(() => {
    if (domainId && open) {
      loadDomainData();
    }
  }, [domainId, open]);

  const loadDomainData = async () => {
    try {
      setLoading(true);
      
      const domainData = emailDomains.find(d => d.id === domainId);
      if (domainData) {
        setDomain(domainData);
        setReportEmail(domainData.report_email || '');
      }

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

  if (!domain) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
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
           <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
             <div>
               <Label className="text-sm font-medium text-gray-700">Domain</Label>
               <p className="text-sm">{domain.domain}</p>
             </div>
             <div>
               <Label className="text-sm font-medium text-gray-700">Status</Label>
               <div className="flex items-center gap-2">
                 <p className="text-sm">{domain.status}</p>
                 {domain.is_sandbox && (
                   <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 flex items-center gap-1">
                     <TestTube className="w-3 h-3" />
                     SANDBOX
                   </Badge>
                 )}
                 {domain.env === 'dev' && !domain.is_sandbox && (
                   <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                     DEV
                   </Badge>
                 )}
               </div>
             </div>
             <div>
               <Label className="text-sm font-medium text-gray-700">Environment</Label>
               <p className="text-sm">{domain.env === 'dev' ? 'Development' : 'Production'}</p>
             </div>
             <div>
               <Label className="text-sm font-medium text-gray-700">Created</Label>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveReportEmail}
                  className="flex items-center gap-2"
                >
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
              <div className="text-sm text-gray-600">
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
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => {
                  const status = getRecordStatus(record);
                  
                  return (
                    <div
                      key={record.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
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
                           {record.applied_provider && (
                             <Badge variant="outline" className="text-xs">
                               {record.applied_provider}
                             </Badge>
                           )}
                         </div>

                      <div className="grid gap-2">
                        <div>
                          <Label className="text-xs text-gray-600">Name</Label>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1">
                              {record.name}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyToClipboard(record.name)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-gray-600">Value</Label>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1 break-all">
                              {formatRecordValue(record.value)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyToClipboard(record.value)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                           {record.value.length > 60 && (
                             <p className="text-xs text-gray-500 mt-1">
                               Click copy to get the full value
                             </p>
                           )}
                           {record.applied_automatically && record.applied_at && (
                             <p className="text-xs text-green-600 mt-1">
                               ✅ Applied automatically on {new Date(record.applied_at).toLocaleString()}
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

           {domain.status !== 'active' && !domain.is_sandbox && (
             <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
               <div className="flex gap-2">
                 <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                 <div className="text-sm text-amber-800">
                   <p className="font-medium mb-1">Setup Required</p>
                   <p>
                     Add these DNS records to your domain provider's DNS settings, then click "Verify DNS" 
                     to complete the setup. It may take up to 48 hours for DNS changes to propagate.
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

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
