import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SMSQuickSendProps {
  onSent: () => void;
}

export const SMSQuickSend: React.FC<SMSQuickSendProps> = ({ onSent }) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !message) {
      toast.error('Please enter both phone number and message');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: phone,
          message: message,
          test: true // Mark as test message
        }
      });

      if (error) throw error;

      toast.success('Test message sent successfully!');
      setPhone('');
      setMessage('');
      onSent();
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const characterCount = message.length;
  const maxLength = 160;

  return (
    <Card id="quick-send">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="h-5 w-5 text-yellow-600" />
          <span>Quick Send</span>
        </CardTitle>
        <CardDescription>Send a test SMS message instantly</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your test message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 min-h-[80px]"
              maxLength={maxLength}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground">
                Test messages are not counted against your quota
              </p>
              <span className={`text-xs ${
                characterCount > maxLength * 0.9 ? 'text-orange-600' : 'text-muted-foreground'
              }`}>
                {characterCount}/{maxLength}
              </span>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={sending || !phone || !message}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Test Message'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};