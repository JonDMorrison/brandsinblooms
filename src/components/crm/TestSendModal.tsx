import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, User, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TestSendModalProps {
  open: boolean;
  onClose: () => void;
  subject: string;
  html: string;
  campaignId?: string;
  automationId?: string;
  automationNodeId?: string;
}

interface CustomerOption {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

type PreviewMode = 'none' | 'sample' | 'customer';

export const TestSendModal: React.FC<TestSendModalProps> = ({
  open,
  onClose,
  subject,
  html,
  campaignId,
  automationId,
  automationNodeId,
}) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  const [toEmail, setToEmail] = useState(user?.email || '');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('sample');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch customers for preview selection
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['crm-customers-test-send', tenantId, customerSearch],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from('crm_customers')
        .select('id, email, first_name, last_name')
        .eq('tenant_id', tenantId)
        .not('email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (customerSearch) {
        // SECURITY: [PostgREST filter injection] - Sanitize user input before interpolation into .or() filter
        const sanitizeForPostgrest = (input: string) => input.replace(/[,.()"'\\]/g, '');
        const safeSearch = sanitizeForPostgrest(customerSearch);
        query = query.or(`email.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerOption[];
    },
    enabled: !!tenantId && previewMode === 'customer',
  });

  const handleSend = async () => {
    if (!toEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setIsSending(true);
    setLastResult(null);

    try {
      const body: Record<string, unknown> = {
        toEmail: toEmail.trim(),
        subject,
        html,
        campaignId,
        automationId,
        automationNodeId,
      };

      if (previewMode === 'customer' && selectedCustomerId) {
        body.customerId = selectedCustomerId;
      } else if (previewMode === 'sample') {
        body.sampleCustomer = {
          first_name: 'Jane',
          last_name: 'Gardener',
          email: 'jane@example.com',
          phone: '(555) 123-4567',
        };
      }

      const { data, error } = await supabase.functions.invoke('send-test-email-v2', { body });

      if (error) throw error;

      if (data?.success) {
        setLastResult({ success: true, message: `Test email sent to ${toEmail}` });
        toast.success('Test email sent successfully!');
      } else {
        throw new Error(data?.error || 'Failed to send test email');
      }
    } catch (err: any) {
      console.error('Test send error:', err);
      setLastResult({ success: false, message: err.message || 'Failed to send' });
      toast.error(err.message || 'Failed to send test email');
    } finally {
      setIsSending(false);
    }
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Test Email
          </DialogTitle>
          <DialogDescription>
            Send a test email to verify your content before sending to your audience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* To Email */}
          <div className="space-y-2">
            <Label htmlFor="to-email">Send to</Label>
            <Input
              id="to-email"
              type="email"
              placeholder="you@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
            />
          </div>

          {/* Preview Mode */}
          <div className="space-y-2">
            <Label>Personalization</Label>
            <NativeSelect
              value={previewMode}
              onChange={(e) => setPreviewMode(e.target.value as PreviewMode)}
            >
              <option value="none">No personalization</option>
              <option value="sample">Sample customer (Jane Gardener)</option>
              <option value="customer">Real customer data</option>
            </NativeSelect>
          </div>

          {/* Customer Selector */}
          {previewMode === 'customer' && (
            <div className="space-y-2">
              <Label>Select Customer</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-32"
                />
                <NativeSelect
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  disabled={customersLoading}
                  className="flex-1"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name || c.email}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {selectedCustomer && (
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  {selectedCustomer.first_name} {selectedCustomer.last_name} ({selectedCustomer.email})
                </Badge>
              )}
            </div>
          )}

          {/* Result Display */}
          {lastResult && (
            <Alert variant={lastResult.success ? 'default' : 'destructive'}>
              {lastResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>{lastResult.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !toEmail.trim()}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
