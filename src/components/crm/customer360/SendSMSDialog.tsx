import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send } from 'lucide-react';

interface SendSMSDialogProps {
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
  };
  open: boolean;
  onClose: () => void;
}

export const SendSMSDialog = ({ customer, open, onClose }: SendSMSDialogProps) => {
  const [message, setMessage] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendSMSMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!customer.phone) {
        throw new Error('Customer does not have a phone number');
      }

      // For now, just simulate sending SMS and log the activity
      // In a real implementation, this would call a Twilio/SMS service
      
      // Log the SMS activity in customer timeline
      const { error } = await supabase
        .from('customer_timeline_events')
        .insert({
          customer_id: customer.id,
          event_type: 'sms_sent',
          event_date: new Date().toISOString(),
          title: `SMS sent to ${customer.phone}`,
          description: message,
          metadata: {
            phone: customer.phone,
            method: 'manual',
            message_length: message.length,
          },
        });

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "SMS Sent Successfully",
        description: `Message sent to ${customer.phone}`,
      });
      
      // Refresh customer activity
      queryClient.invalidateQueries({ 
        queryKey: ['customer-timeline-events', customer.id] 
      });
      
      setMessage('');
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send SMS",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return;
    }

    if (message.length > 160) {
      toast({
        title: "Message Too Long",
        description: "SMS messages should be under 160 characters",
        variant: "destructive",
      });
      return;
    }

    sendSMSMutation.mutate({ message: message.trim() });
  };

  const getCustomerName = () => {
    if (customer.first_name && customer.last_name) {
      return `${customer.first_name} ${customer.last_name}`;
    }
    if (customer.first_name) {
      return customer.first_name;
    }
    return customer.email;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send SMS
          </DialogTitle>
          <DialogDescription>
            Send a text message to {getCustomerName()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>To:</Label>
            <Badge variant="outline" className="font-mono">
              {customer.phone}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] resize-none"
              maxLength={160}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>SMS messages are best kept under 160 characters</span>
              <span className={message.length > 160 ? 'text-destructive' : ''}>
                {message.length}/160
              </span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              disabled={sendSMSMutation.isPending || !message.trim() || !customer.phone}
            >
              {sendSMSMutation.isPending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send SMS
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};