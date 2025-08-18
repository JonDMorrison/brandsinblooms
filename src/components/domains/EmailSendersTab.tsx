import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Copy,
  Send,
  Info
} from 'lucide-react';
import { EmailSender, useDomains } from '@/hooks/useDomains';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EmailSendersTabProps {
  emailSenders: EmailSender[];
}

export const EmailSendersTab: React.FC<EmailSendersTabProps> = ({ emailSenders }) => {
  const { addEmailSender } = useDomains();
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleAddSender = async () => {
    if (!newSenderEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newSenderEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await addEmailSender(newSenderEmail, newDisplayName || undefined);
      toast.success('Email sender added! Verification will begin automatically.');
      setNewSenderEmail('');
      setNewDisplayName('');
    } catch (error) {
      console.error('Error adding email sender:', error);
      toast.error('Failed to add email sender');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestEmail = async (senderId: string) => {
    if (!testEmail.trim()) {
      toast.error('Please enter a test email address');
      return;
    }

    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          senderId,
          testEmail
        }
      });

      if (error) throw error;
      toast.success('Test email sent successfully!');
      setTestEmail('');
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('Failed to send test email');
    } finally {
      setIsSendingTest(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock, text: 'Pending', color: 'text-yellow-600' },
      verifying: { variant: 'outline' as const, icon: Clock, text: 'Verifying', color: 'text-blue-600' },
      verified: { variant: 'default' as const, icon: CheckCircle2, text: 'Verified', color: 'text-green-600' },
      failed: { variant: 'destructive' as const, icon: AlertCircle, text: 'Failed', color: 'text-red-600' }
    };

    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {config.text}
      </Badge>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      {/* Add New Sender */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Email Sender
          </CardTitle>
          <CardDescription>
            Add a new email address for sending campaigns and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sender-email">Sender Email *</Label>
              <Input
                id="sender-email"
                type="email"
                placeholder="hello@yourdomain.com"
                value={newSenderEmail}
                onChange={(e) => setNewSenderEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                placeholder="Your Business Name"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Email Verification Process:</p>
                <p>We'll automatically set up SPF, DKIM, and DMARC records through our email provider. 
                For custom domains, you may need to add DNS records to improve deliverability.</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleAddSender}
            disabled={isSubmitting || !newSenderEmail.trim()}
          >
            {isSubmitting ? 'Adding...' : 'Add Email Sender'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Senders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Senders
          </CardTitle>
          <CardDescription>
            Manage your configured email senders and their verification status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSenders.length > 0 ? (
            <div className="space-y-4">
              {emailSenders.map((sender) => (
                <div key={sender.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{sender.sender_email}</p>
                        {sender.display_name && (
                          <p className="text-sm text-muted-foreground">{sender.display_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(sender.status)}
                    </div>
                  </div>

                  {sender.verified && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {sender.dkim_host && (
                          <div className="space-y-1">
                            <p className="font-medium text-green-700">DKIM</p>
                            <p className="text-muted-foreground">Configured</p>
                          </div>
                        )}
                        {sender.spf_value && (
                          <div className="space-y-1">
                            <p className="font-medium text-green-700">SPF</p>
                            <p className="text-muted-foreground">Configured</p>
                          </div>
                        )}
                        {sender.dmarc_value && (
                          <div className="space-y-1">
                            <p className="font-medium text-green-700">DMARC</p>
                            <p className="text-muted-foreground">Configured</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <Label htmlFor={`test-email-${sender.id}`} className="text-sm font-medium">
                            Send Test Email:
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id={`test-email-${sender.id}`}
                            type="email"
                            placeholder="test@example.com"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestEmail(sender.id)}
                            disabled={isSendingTest || !testEmail.trim()}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {isSendingTest ? 'Sending...' : 'Send'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {sender.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm text-red-700">
                        <strong>Error:</strong> {sender.error}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No email senders configured yet</p>
              <p className="text-sm text-muted-foreground">
                Add an email sender above to start sending campaigns and notifications
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
