import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Send, AlertTriangle, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OptInRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unknownCount: number;
  onComplete: () => void;
}

export function OptInRequestModal({
  open,
  onOpenChange,
  unknownCount,
  onComplete,
}: OptInRequestModalProps) {
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!user?.user_metadata?.tenant_id || !confirmed) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-opt-in-request', {
        body: {
          tenantId: user.user_metadata.tenant_id,
        },
      });

      if (error) {
        throw error;
      }

      toast.success(`Opt-in requests sent to ${data?.sent || 0} contacts`);
      onComplete();
    } catch (err) {
      console.error('Failed to send opt-in requests:', err);
      toast.error('Failed to send opt-in requests');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Opt-In Request Email
          </DialogTitle>
          <DialogDescription>
            Invite contacts with unknown consent status to subscribe to your marketing emails
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Target Audience</p>
                  <p className="text-sm text-muted-foreground">
                    Contacts with unknown consent status
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{unknownCount}</p>
                  <p className="text-sm text-muted-foreground">contacts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Preview */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="font-medium text-sm">Email Preview</p>
              <div className="bg-muted rounded-lg p-4 text-sm space-y-3">
                <p className="font-medium">Subject: Can we send you garden updates?</p>
                <hr className="border-border" />
                <p>Hi [First Name],</p>
                <p>
                  You're receiving this email because you shared your email with us 
                  for a purchase, course, or event.
                </p>
                <p>We'd love to occasionally send you:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Seasonal gardening tips</li>
                  <li>New arrivals and promotions</li>
                  <li>Updates on workshops and events</li>
                </ul>
                <p>Please choose your email preferences:</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" disabled>
                    Yes, I'd like updates
                  </Button>
                  <Button size="sm" variant="outline" disabled>
                    No, thank you
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warning */}
          <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              This is a one-time consent request. We will not repeatedly contact people 
              who don't respond. Contacts who click "Yes" will be opted in, those who 
              click "No" will be opted out, and those who don't respond will remain 
              in unknown status.
            </AlertDescription>
          </Alert>

          {/* Confirmation */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <label
              htmlFor="confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand this will send an email to {unknownCount} contacts
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!confirmed || sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Opt-In Requests
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
