import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Copy, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DnsInstructionsCardProps {
  domainId: string;
  open: boolean;
  onClose: () => void;
}

interface DnsRecord {
  id: string;
  name: string;
  type: string;
  value: string;
  purpose: string;
  required: boolean;
}

export const DnsInstructionsCard: React.FC<DnsInstructionsCardProps> = ({ domainId, open, onClose }) => {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [domain, setDomain] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open && domainId) {
      fetchDnsRecords();
    }
  }, [open, domainId]);

  const fetchDnsRecords = async () => {
    setLoading(true);
    try {
      // Get domain info
      const { data: domainData } = await supabase
        .from('email_domains')
        .select('domain, dns_records')
        .eq('id', domainId)
        .single();

      if (domainData) {
        setDomain(domainData.domain);
      }

      // Get DNS records from dedicated table
      const { data: dnsRecords, error } = await supabase
        .from('email_dns_records')
        .select('*')
        .eq('email_domain_id', domainId)
        .order('purpose', { ascending: true });

      if (error) throw error;
      setRecords(dnsRecords || []);
    } catch (err) {
      console.error('Error fetching DNS records:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, recordId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(recordId);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPurposeInfo = (purpose: string): { label: string; description: string } => {
    switch (purpose) {
      case 'dkim': 
        return { 
          label: 'DKIM (Email Signing)', 
          description: 'Adds a digital signature to prove your emails are authentic and unchanged' 
        };
      case 'spf': 
        return { 
          label: 'SPF (Sender Policy)', 
          description: 'Tells mailboxes which servers are allowed to send emails for your domain' 
        };
      case 'return_path': 
        return { 
          label: 'Return Path', 
          description: 'Where bounce notifications are sent when emails can\'t be delivered' 
        };
      case 'dmarc': 
        return { 
          label: 'DMARC (Policy)', 
          description: 'Instructs mailboxes what to do if authentication checks fail' 
        };
      case 'verification': 
        return { 
          label: 'Domain Verification', 
          description: 'Proves you own this domain and have permission to send from it' 
        };
      default: 
        return { label: purpose, description: '' };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>DNS Configuration for {domain}</DialogTitle>
          <DialogDescription>
            Add these records to your DNS provider to verify your domain and enable email sending.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No DNS records found. Please try refreshing the domain verification.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* What These Records Do */}
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <CardContent className="py-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">What are DNS records?</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  DNS records are like address book entries that tell the internet where to find things. 
                  These specific records tell email providers that BloomSuite is authorized to send emails 
                  on behalf of your domain, improving deliverability and preventing your emails from being 
                  marked as spam.
                </p>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="bg-muted/50">
              <CardContent className="py-4">
                <h4 className="font-medium mb-2">How to add these records:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Log in to your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.)</li>
                  <li>Navigate to DNS settings for <span className="font-medium text-foreground">{domain}</span></li>
                  <li>Add each record below with the <span className="font-medium text-foreground">exact</span> Type, Name, and Value</li>
                  <li>Save changes and allow up to 48 hours for propagation (usually much faster)</li>
                </ol>
              </CardContent>
            </Card>

            {/* DNS Records Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">Value</th>
                    <th className="text-left px-4 py-2 font-medium w-20">TTL</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-t">
                      <td className="px-4 py-3">
                        <Badge variant="outline">{record.type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">
                          {record.name}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all max-w-[200px] block overflow-hidden text-ellipsis">
                          {record.value}
                        </code>
                        <div className="mt-1">
                          <p className="text-xs font-medium text-foreground">
                            {getPurposeInfo(record.purpose).label}
                          </p>
                          {getPurposeInfo(record.purpose).description && (
                            <p className="text-xs text-muted-foreground">
                              {getPurposeInfo(record.purpose).description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">Auto</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(record.value, record.id)}
                        >
                          {copiedId === record.id ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Provider Links */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Quick links:</span>
              <a 
                href="https://dash.cloudflare.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Cloudflare <ExternalLink className="h-3 w-3" />
              </a>
              <a 
                href="https://dcc.godaddy.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                GoDaddy <ExternalLink className="h-3 w-3" />
              </a>
              <a 
                href="https://ap.www.namecheap.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Namecheap <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Troubleshooting Tips */}
            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
              <CardContent className="py-4">
                <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Troubleshooting Tips</h4>
                <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• <span className="font-medium">Records not verifying?</span> DNS changes can take 15 min to 48 hours to propagate.</li>
                  <li>• <span className="font-medium">Copy values exactly</span> — even small typos will cause verification to fail.</li>
                  <li>• <span className="font-medium">Some providers require "@"</span> for the root domain instead of the domain name.</li>
                  <li>• <span className="font-medium">Cloudflare users:</span> Make sure the proxy (orange cloud) is OFF for these records.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
