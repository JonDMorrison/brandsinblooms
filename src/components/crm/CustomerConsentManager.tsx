import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Mail, 
  MessageSquare,
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Pencil, 
  Loader2,
  History,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getEmailConsentStatus,
  getConsentStatusLabel as getEmailConsentStatusLabel,
  getConsentStatusColor as getEmailConsentStatusColor,
  getCustomerConsentHistory,
  updateCustomerConsent,
  ConsentEvent,
  EmailConsentStatus,
} from '@/lib/crm/emailConsent';
import {
  getSMSConsentStatus,
  getSMSConsentStatusLabel,
  getSMSConsentStatusColor,
  getCustomerSMSConsentHistory,
  updateCustomerSMSConsent,
  SMSConsentEvent,
  SMSConsentStatus,
} from '@/lib/crm/smsConsent';
import { toast } from 'sonner';

interface CustomerConsentManagerProps {
  customer: {
    id: string;
    email: string;
    phone?: string | null;
    email_opt_in: boolean | null;
    sms_opt_in: boolean | null;
    tenant_id: string | null;
  };
  onConsentUpdated?: () => void;
}

export function CustomerConsentManager({ customer, onConsentUpdated }: CustomerConsentManagerProps) {
  const [emailHistory, setEmailHistory] = useState<ConsentEvent[]>([]);
  const [smsHistory, setSmsHistory] = useState<SMSConsentEvent[]>([]);
  const [loadingEmail, setLoadingEmail] = useState(true);
  const [loadingSms, setLoadingSms] = useState(true);
  
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [newEmailConsent, setNewEmailConsent] = useState<'opted_in' | 'opted_out'>(
    customer.email_opt_in === true ? 'opted_in' : 'opted_out'
  );
  const [newSmsConsent, setNewSmsConsent] = useState<'opted_in' | 'opted_out'>(
    customer.sms_opt_in === true ? 'opted_in' : 'opted_out'
  );
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingSms, setUpdatingSms] = useState(false);
  
  const [emailHistoryOpen, setEmailHistoryOpen] = useState(false);
  const [smsHistoryOpen, setSmsHistoryOpen] = useState(false);

  const emailStatus = getEmailConsentStatus(customer);
  const smsStatus = getSMSConsentStatus({ sms_opt_in: customer.sms_opt_in ?? null });

  useEffect(() => {
    const fetchEmailHistory = async () => {
      setLoadingEmail(true);
      const data = await getCustomerConsentHistory(customer.id);
      setEmailHistory(data);
      setLoadingEmail(false);
    };
    fetchEmailHistory();
  }, [customer.id]);

  useEffect(() => {
    const fetchSmsHistory = async () => {
      setLoadingSms(true);
      const data = await getCustomerSMSConsentHistory(customer.id);
      setSmsHistory(data);
      setLoadingSms(false);
    };
    fetchSmsHistory();
  }, [customer.id]);

  const getStatusIcon = (status: EmailConsentStatus | SMSConsentStatus) => {
    switch (status) {
      case 'opted_in': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'opted_out': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'unknown': return <HelpCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    switch (eventType) {
      case 'opt_in': return 'Opted In';
      case 'opt_out': return 'Opted Out';
      case 'opt_in_request_sent': return 'Opt-In Request Sent';
      case 'imported_unknown': return 'Imported (Unknown)';
      case 'updated_by_admin': return 'Updated by Admin';
      case 'keyword_start': return 'Keyword: START';
      case 'keyword_stop': return 'Keyword: STOP';
      default: return eventType;
    }
  };

  const handleUpdateEmailConsent = async () => {
    if (!customer.tenant_id) {
      toast.error('Missing tenant information');
      return;
    }

    setUpdatingEmail(true);
    try {
      const result = await updateCustomerConsent({
        tenantId: customer.tenant_id,
        customerId: customer.id,
        email: customer.email,
        optIn: newEmailConsent === 'opted_in',
        source: 'admin_panel',
      });

      if (result.success) {
        toast.success('Email consent updated successfully');
        setShowEmailModal(false);
        const data = await getCustomerConsentHistory(customer.id);
        setEmailHistory(data);
        onConsentUpdated?.();
      } else {
        toast.error(result.error || 'Failed to update consent');
      }
    } catch (err) {
      console.error('Error updating email consent:', err);
      toast.error('Failed to update consent');
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleUpdateSmsConsent = async () => {
    if (!customer.tenant_id) {
      toast.error('Missing tenant information');
      return;
    }

    if (!customer.phone) {
      toast.error('Customer has no phone number');
      return;
    }

    setUpdatingSms(true);
    try {
      const result = await updateCustomerSMSConsent({
        tenantId: customer.tenant_id,
        customerId: customer.id,
        phone: customer.phone,
        optIn: newSmsConsent === 'opted_in',
        source: 'admin_panel',
      });

      if (result.success) {
        toast.success('SMS consent updated successfully');
        setShowSmsModal(false);
        const data = await getCustomerSMSConsentHistory(customer.id);
        setSmsHistory(data);
        onConsentUpdated?.();
      } else {
        toast.error(result.error || 'Failed to update SMS consent');
      }
    } catch (err) {
      console.error('Error updating SMS consent:', err);
      toast.error('Failed to update SMS consent');
    } finally {
      setUpdatingSms(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Communication Preferences</CardTitle>
        <CardDescription>Manage email and SMS marketing consent</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Email Consent Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Email Consent</span>
              </div>
              <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Pencil className="h-3 w-3 mr-1" />
                    Update
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Email Consent</DialogTitle>
                    <DialogDescription>
                      Change email marketing consent for {customer.email}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <RadioGroup value={newEmailConsent} onValueChange={(v) => setNewEmailConsent(v as 'opted_in' | 'opted_out')}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="opted_in" id="email_opted_in" />
                        <Label htmlFor="email_opted_in" className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Opted in to marketing emails
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="opted_out" id="email_opted_out" />
                        <Label htmlFor="email_opted_out" className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Opted out of marketing emails
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowEmailModal(false)} disabled={updatingEmail}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateEmailConsent} disabled={updatingEmail}>
                      {updatingEmail ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              {getStatusIcon(emailStatus)}
              <div>
                <p className="text-sm text-muted-foreground">Current Status</p>
                <Badge variant={getEmailConsentStatusColor(emailStatus)}>
                  {getEmailConsentStatusLabel(emailStatus)}
                </Badge>
              </div>
            </div>

            <Collapsible open={emailHistoryOpen} onOpenChange={setEmailHistoryOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Email History
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${emailHistoryOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                {loadingEmail ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : emailHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No history recorded</p>
                ) : (
                  <div className="rounded-md border max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Event</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emailHistory.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="text-xs">
                              {format(new Date(event.created_at), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {getEventTypeLabel(event.event_type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {event.source}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* SMS Consent Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">SMS Consent</span>
              </div>
              <Dialog open={showSmsModal} onOpenChange={setShowSmsModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!customer.phone}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Update
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update SMS Consent</DialogTitle>
                    <DialogDescription>
                      Change SMS marketing consent for {customer.phone}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <RadioGroup value={newSmsConsent} onValueChange={(v) => setNewSmsConsent(v as 'opted_in' | 'opted_out')}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="opted_in" id="sms_opted_in" />
                        <Label htmlFor="sms_opted_in" className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Opted in to marketing SMS
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="opted_out" id="sms_opted_out" />
                        <Label htmlFor="sms_opted_out" className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Opted out of marketing SMS
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSmsModal(false)} disabled={updatingSms}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateSmsConsent} disabled={updatingSms}>
                      {updatingSms ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {customer.phone ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  {getStatusIcon(smsStatus)}
                  <div>
                    <p className="text-sm text-muted-foreground">Current Status</p>
                    <Badge variant={getSMSConsentStatusColor(smsStatus)}>
                      {getSMSConsentStatusLabel(smsStatus)}
                    </Badge>
                  </div>
                </div>

                <Collapsible open={smsHistoryOpen} onOpenChange={setSmsHistoryOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        SMS History
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${smsHistoryOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    {loadingSms ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : smsHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No history recorded</p>
                    ) : (
                      <div className="rounded-md border max-h-48 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Date</TableHead>
                              <TableHead className="text-xs">Event</TableHead>
                              <TableHead className="text-xs">Source</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {smsHistory.map((event) => (
                              <TableRow key={event.id}>
                                <TableCell className="text-xs">
                                  {format(new Date(event.created_at), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {getEventTypeLabel(event.event_type)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {event.source}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No phone number on file</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
