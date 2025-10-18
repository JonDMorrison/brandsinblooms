import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sendCampaignTestEmail, isValidEmail } from '@/lib/sendTestEmail';
import { Send, Loader2, Plus, X } from 'lucide-react';

interface TestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignData: {
    name: string;
    subject_line: string;
    content: string;
    id?: string; // Optional campaign ID for tracking
  };
  onTestSent?: () => void;
}

export const TestEmailModal: React.FC<TestEmailModalProps> = ({
  isOpen,
  onClose,
  campaignData,
  onTestSent
}) => {
  const { toast } = useToast();
  const [emails, setEmails] = useState<string[]>(['']);
  const [testName, setTestName] = useState('Test User');
  const [sending, setSending] = useState(false);

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const removeEmailField = (index: number) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const validateEmails = () => {
    const validEmails = emails.filter(email => {
      return email.trim() && isValidEmail(email.trim());
    });
    
    return validEmails;
  };

  const sendTestEmail = async () => {
    const validEmails = validateEmails();
    
    if (validEmails.length === 0) {
      toast({
        title: "Invalid Email",
        description: "Please enter at least one valid email address.",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const email of validEmails) {
        const result = await sendCampaignTestEmail({
          email: email.trim(),
          subject: campaignData.subject_line || 'Test Email',
          content: campaignData.content,
          testName: testName,
          campaignId: campaignData.id
        });

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          console.error('Error sending test email to', email, ':', result.error);
          
          // Show individual failure toast for better UX
          toast({
            title: "Error",
            description: `Failed to send to ${email}: ${result.message}`,
            variant: "destructive"
          });
        }
      }

      // Show summary toast
      if (successCount > 0) {
        toast({
          title: "Test Email Sent",
          description: `Successfully sent to ${successCount} of ${validEmails.length} recipient${validEmails.length > 1 ? 's' : ''}`,
        });

        if (successCount === validEmails.length) {
          // Only close and reset if all succeeded
          onTestSent?.();
          onClose();
          setEmails(['']);
          setTestName('Test User');
        }
      } else {
        toast({
          title: "All Test Emails Failed",
          description: "None of the test emails could be sent. Please check your email configuration.",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('Unexpected error sending test emails:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Test Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="testName">Preview Name</Label>
            <Input
              id="testName"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Test User"
              className="mt-1"
            />
            <p className="text-sm text-muted-foreground mt-1">
              This will replace {'{firstName}'} in your email content
            </p>
          </div>

          <div>
            <Label>Test Email Recipients</Label>
            <div className="space-y-2 mt-1">
              {emails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    placeholder="test@example.com"
                    type="email"
                  />
                  {emails.length > 1 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeEmailField(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={addEmailField}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Another Email
            </Button>
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Test Email Details:</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><strong>Subject:</strong> {campaignData.subject_line || 'Test Email'}</p>
              <p><strong>From:</strong> Your Company &lt;hello@notify.bloomsuite.app&gt;</p>
              <p><strong>Note:</strong> Test emails include [TEST] prefix and don't count toward metrics</p>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={sendTestEmail} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};