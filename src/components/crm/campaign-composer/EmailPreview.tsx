import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Monitor, 
  Smartphone, 
  Send, 
  Loader2,
  Mail
} from 'lucide-react';

interface EmailPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  content: string;
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({
  isOpen,
  onClose,
  subject,
  content
}) => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address for the test",
        variant: "destructive"
      });
      return;
    }

    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          to: testEmail,
          subject: subject || 'Test Email Campaign',
          html: content
        }
      });

      if (error) throw error;

      toast({
        title: "Test Email Sent!",
        description: `Test email has been sent to ${testEmail}`
      });
      
      setTestEmail('');
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive"
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-green-600" />
            Email Preview
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full">
          {/* Controls */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'desktop' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('desktop')}
              >
                <Monitor className="h-4 w-4 mr-1" />
                Desktop
              </Button>
              <Button
                variant={viewMode === 'mobile' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('mobile')}
              >
                <Smartphone className="h-4 w-4 mr-1" />
                Mobile
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="test-email" className="text-sm">Send test to:</Label>
                <Input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  className="w-48"
                />
                <Button 
                  onClick={sendTestEmail} 
                  disabled={sendingTest}
                  size="sm"
                >
                  {sendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Subject Line Preview */}
          <div className="p-4 bg-gray-50 border-b">
            <div className="text-sm text-muted-foreground mb-1">Subject Line:</div>
            <div className="font-medium">{subject || 'No subject line set'}</div>
          </div>
          
          {/* Email Preview */}
          <div className="flex-1 overflow-auto p-4 bg-gray-100">
            <div 
              className={`mx-auto bg-white shadow-lg transition-all duration-300 ${
                viewMode === 'mobile' 
                  ? 'w-full max-w-sm' 
                  : 'w-full max-w-2xl'
              }`}
              style={{
                minHeight: '600px'
              }}
            >
              <div 
                className="w-full h-full"
                style={{
                  transform: viewMode === 'mobile' ? 'scale(0.9)' : 'scale(1)',
                  transformOrigin: 'top center'
                }}
              >
                <iframe
                  srcDoc={content}
                  className="w-full h-full border-0"
                  style={{ 
                    minHeight: '600px',
                    height: '100%'
                  }}
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Preview shows how your email will appear to recipients
              </div>
              <Button variant="outline" onClick={onClose}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};