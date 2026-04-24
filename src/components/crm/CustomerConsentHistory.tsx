import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Badge } from '@/components/ui-legacy/badge';
import { Button } from '@/components/ui-legacy/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui-legacy/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui-legacy/radio-group';
import { Label } from '@/components/ui-legacy/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui-legacy/table';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Pencil, 
  Loader2,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getEmailConsentStatus,
  getConsentStatusLabel,
  getConsentStatusColor,
  getCustomerConsentHistory,
  updateCustomerConsent,
  ConsentEvent,
  EmailConsentStatus,
} from '@/lib/crm/emailConsent';
import { toast } from 'sonner';

interface CustomerConsentHistoryProps {
  customer: {
    id: string;
    email: string;
    email_opt_in: boolean | null;
    tenant_id?: string | null;
  };
  onConsentUpdated?: () => void;
}

export function CustomerConsentHistory({ customer, onConsentUpdated }: CustomerConsentHistoryProps) {
  const [history, setHistory] = useState<ConsentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newConsent, setNewConsent] = useState<'opted_in' | 'opted_out'>('opted_in');
  const [updating, setUpdating] = useState(false);

  const consentStatus = getEmailConsentStatus(customer);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const data = await getCustomerConsentHistory(customer.id);
      setHistory(data);
      setLoading(false);
    };
    fetchHistory();
  }, [customer.id]);

  const getStatusIcon = (status: EmailConsentStatus) => {
    switch (status) {
      case 'opted_in': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'opted_out': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'unknown': return <HelpCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    switch (eventType) {
      case 'opt_in': return 'Opted In';
      case 'opt_out': return 'Opted Out';
      case 'opt_in_request_sent': return 'Opt-In Request Sent';
      case 'imported_unknown': return 'Imported (Unknown)';
      case 'updated_by_admin': return 'Updated by Admin';
      default: return eventType;
    }
  };

  const handleUpdateConsent = async () => {
    if (!customer.tenant_id) {
      toast.error('Missing tenant information');
      return;
    }

    setUpdating(true);
    try {
      const result = await updateCustomerConsent({
        tenantId: customer.tenant_id,
        customerId: customer.id,
        email: customer.email,
        optIn: newConsent === 'opted_in',
        source: 'admin_panel',
      });

      if (result.success) {
        toast.success('Consent updated successfully');
        setShowUpdateModal(false);
        // Refresh history
        const data = await getCustomerConsentHistory(customer.id);
        setHistory(data);
        onConsentUpdated?.();
      } else {
        toast.error(result.error || 'Failed to update consent');
      }
    } catch (err) {
      console.error('Error updating consent:', err);
      toast.error('Failed to update consent');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Consent
          </CardTitle>
          <CardDescription>Marketing email consent status and history</CardDescription>
        </div>
        <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Update Consent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Consent Manually</DialogTitle>
              <DialogDescription>
                Change the marketing consent status for {customer.email}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <RadioGroup value={newConsent} onValueChange={(v) => setNewConsent(v as 'opted_in' | 'opted_out')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="opted_in" id="opted_in" />
                  <Label htmlFor="opted_in" className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Opted in to marketing emails
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="opted_out" id="opted_out" />
                  <Label htmlFor="opted_out" className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Opted out of marketing emails
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpdateModal(false)} disabled={updating}>
                Cancel
              </Button>
              <Button onClick={handleUpdateConsent} disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          {getStatusIcon(consentStatus)}
          <div>
            <p className="font-medium">Current Status</p>
            <Badge variant={getConsentStatusColor(consentStatus)}>
              {getConsentStatusLabel(consentStatus)}
            </Badge>
          </div>
        </div>

        {/* History */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Consent History</p>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No consent history recorded
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-sm">
                        {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getEventTypeLabel(event.event_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.source}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.ip_address || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
