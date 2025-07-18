
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Save, 
  Eye, 
  Smartphone, 
  Monitor, 
  Send,
  Paintbrush,
  User,
  Calendar,
  Package,
  ArrowLeft
} from 'lucide-react';

interface CRMSimpleEmailBuilderProps {
  onSwitchToAdvanced: () => void;
}

export const CRMSimpleEmailBuilder: React.FC<CRMSimpleEmailBuilderProps> = ({
  onSwitchToAdvanced
}) => {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState<any>(null);
  const [subjectLine, setSubjectLine] = useState('');
  const [message, setMessage] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [autoSaving, setAutoSaving] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  // Personalization tokens
  const personalizationTokens = [
    { label: 'First Name', value: '{{first_name}}', icon: User },
    { label: 'Last Name', value: '{{last_name}}', icon: User },
    { label: 'Email', value: '{{email}}', icon: User },
    { label: 'Purchase Date', value: '{{last_purchase_date}}', icon: Calendar },
    { label: 'Favorite Product', value: '{{favorite_product}}', icon: Package },
  ];

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId]);

  useEffect(() => {
    setCharacterCount(message.length);
  }, [message]);

  // Auto-save functionality
  useEffect(() => {
    if (campaignId && (subjectLine || message)) {
      const timeoutId = setTimeout(() => {
        saveContent();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [subjectLine, message, campaignId]);

  const loadCampaign = async () => {
    if (!campaignId) return;
    
    const { data, error } = await supabase
      .from('crm_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    
    if (error) {
      console.error('Error loading campaign:', error);
      toast.error('Failed to load campaign');
      return;
    }
    
    setCampaign(data);
    setSubjectLine(data.subject_line || '');
    setMessage(data.content || '');
  };

  const saveContent = async () => {
    if (!campaignId) return;
    
    setAutoSaving(true);
    
    try {
      const { error } = await supabase
        .from('crm_campaigns')
        .update({
          subject_line: subjectLine,
          content: message,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      if (error) throw error;
      
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save changes');
    } finally {
      setAutoSaving(false);
    }
  };

  const insertToken = (token: string) => {
    const textarea = document.getElementById('message-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.substring(0, start) + token + message.substring(end);
      setMessage(newMessage);
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setMessage(prev => prev + token);
    }
  };

  const generatePreviewHTML = () => {
    const processedMessage = message
      .replace(/{{first_name}}/g, 'John')
      .replace(/{{last_name}}/g, 'Doe')
      .replace(/{{email}}/g, 'john.doe@example.com')
      .replace(/{{last_purchase_date}}/g, 'March 15, 2024')
      .replace(/{{favorite_product}}/g, 'Premium Garden Set');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 24px; color: #1f2937;">${subjectLine || 'Your Email Subject'}</h1>
        </div>
        <div style="line-height: 1.6; color: #374151; white-space: pre-wrap;">${processedMessage || 'Your email message will appear here...'}</div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
          <p>Best regards,<br>Your Garden Center Team</p>
        </div>
      </div>
    `;
  };

  const handleSwitchToAdvanced = () => {
    if (message.trim() || subjectLine.trim()) {
      if (confirm('Switching to Advanced mode will convert your simple message to blocks. Continue?')) {
        onSwitchToAdvanced();
      }
    } else {
      onSwitchToAdvanced();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Simple Email Builder</h1>
            {campaign && (
              <Badge variant="outline">{campaign.name}</Badge>
            )}
            {autoSaving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Auto-saving...
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitchToAdvanced}
              className="gap-2"
            >
              <Paintbrush className="w-4 h-4" />
              Switch to Advanced
            </Button>
            
            {/* Preview Mode Toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden bg-background">
              <Button
                variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('desktop')}
                className="rounded-none border-0 gap-2"
              >
                <Monitor className="w-4 h-4" />
                Desktop
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPreviewMode('mobile')}
                className="rounded-none border-0 gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Mobile
              </Button>
            </div>
            
            <Button variant="outline" size="sm">Send Test Email</Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Schedule Campaign
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Editor */}
        <div className="flex-1 p-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Subject Line */}
                <div>
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    value={subjectLine}
                    onChange={(e) => setSubjectLine(e.target.value)}
                    placeholder="Enter your email subject line..."
                    className="mt-2"
                  />
                </div>

                {/* Message Content */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="message-content">Message</Label>
                    <span className="text-sm text-muted-foreground">
                      {characterCount} characters
                    </span>
                  </div>
                  <Textarea
                    id="message-content"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your email message here..."
                    className="min-h-[300px] resize-y"
                  />
                </div>

                {/* Personalization Tokens */}
                <div>
                  <Label className="text-sm font-medium">Quick Insert</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {personalizationTokens.map((token) => {
                      const IconComponent = token.icon;
                      return (
                        <Button
                          key={token.value}
                          variant="outline"
                          size="sm"
                          onClick={() => insertToken(token.value)}
                          className="justify-start gap-2 h-auto py-2"
                        >
                          <IconComponent className="h-3 w-3" />
                          <span className="text-xs">{token.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="w-80 border-l bg-muted/10 p-6">
          <div className="sticky top-24">
            <h3 className="font-semibold mb-4">Live Preview</h3>
            <div className={`bg-white shadow-xl rounded-lg border ${
              previewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'
            }`}>
              <div 
                className="p-4 overflow-auto max-h-[600px]"
                dangerouslySetInnerHTML={{ __html: generatePreviewHTML() }}
              />
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-900 mb-1">Preview Notes:</p>
              <p className="text-blue-700">
                Personalization tokens show sample data. Real recipient data will be used when sent.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
