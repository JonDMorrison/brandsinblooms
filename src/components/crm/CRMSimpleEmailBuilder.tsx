import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  Save, 
  Eye, 
  Smartphone, 
  Monitor, 
  Send,
  Paintbrush,
  User,
  Calendar as CalendarIcon,
  Package,
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Clock,
  Mail,
  Users,
  Zap,
  X,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';

interface CRMSimpleEmailBuilderProps {
  campaignId: string;
  selectedSegments: string[];
  onSwitchToAdvanced: () => void;
}

export const CRMSimpleEmailBuilder: React.FC<CRMSimpleEmailBuilderProps> = ({
  campaignId,
  selectedSegments,
  onSwitchToAdvanced
}) => {
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [message, setMessage] = useState('');
  const [coverImage, setCoverImage] = useState<{url: string; alt: string} | null>(null);
  const [ctaButton, setCtaButton] = useState<{text: string; url: string} | null>(null);
  const [showCtaButton, setShowCtaButton] = useState(false);
  
  // Send options
  const [sendOption, setSendOption] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [testEmail, setTestEmail] = useState('');
  
  // UI state
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [autoSaving, setAutoSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Personalization tokens
  const personalizationTokens = [
    { label: 'First Name', value: '{{first_name}}', icon: User },
    { label: 'Last Name', value: '{{last_name}}', icon: User },
    { label: 'Email', value: '{{email}}', icon: Mail },
    { label: 'Purchase Date', value: '{{last_purchase_date}}', icon: CalendarIcon },
    { label: 'Favorite Product', value: '{{favorite_product}}', icon: Package },
  ];

  useEffect(() => {
    loadCampaign();
    loadSegments();
  }, [campaignId]);

  // Auto-save functionality
  useEffect(() => {
    if (campaignName || subjectLine || message) {
      setHasUnsavedChanges(true);
      const timeoutId = setTimeout(() => {
        saveContent();
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [campaignName, subjectLine, message, coverImage, ctaButton]);

  // Prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
      
      if (error) throw error;
      
      setCampaignName(data.name || '');
      setSubjectLine(data.subject_line || '');
      setMessage(data.content || '');
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const loadSegments = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_segments')
        .select('*')
        .in('id', selectedSegments);
      
      if (error) throw error;
      setSegments(data || []);
    } catch (error) {
      console.error('Error loading segments:', error);
    }
  };

  const saveContent = async () => {
    if (!campaignId) return;
    
    setAutoSaving(true);
    
    try {
      const { error } = await supabase
        .from('crm_campaigns')
        .update({
          name: campaignName,
          subject_line: subjectLine,
          content: message,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      if (error) throw error;
      setHasUnsavedChanges(false);
      
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save changes');
    } finally {
      setAutoSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('content-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('content-assets')
        .getPublicUrl(fileName);

      setCoverImage({ url: publicUrl, alt: '' });
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    }
  };

  const insertToken = (token: string) => {
    // For now, just append the token to the message
    // In the future, we could integrate with TipTap's editor commands for cursor positioning
    setMessage(prev => prev + token);
  };

  const generatePreviewHTML = () => {
    const processedMessage = message
      .replace(/{{first_name}}/g, 'John')
      .replace(/{{last_name}}/g, 'Doe')
      .replace(/{{email}}/g, 'john.doe@example.com')
      .replace(/{{last_purchase_date}}/g, 'March 15, 2024')
      .replace(/{{favorite_product}}/g, 'Premium Garden Set');

    return `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        ${coverImage ? `
          <div style="margin-bottom: 32px;">
            <img src="${coverImage.url}" alt="${coverImage.alt}" style="width: 100%; height: auto; border-radius: 12px;" />
          </div>
        ` : ''}
        <div style="padding: 32px;">
          <div style="margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827; line-height: 1.2;">${subjectLine || 'Your Email Subject'}</h1>
          </div>
          <div style="font-size: 16px; line-height: 1.7; color: #374151; white-space: pre-wrap; margin-bottom: 32px;">${processedMessage || 'Your email message will appear here...'}</div>
          ${ctaButton && showCtaButton ? `
            <div style="margin: 32px 0;">
              <a href="${ctaButton.url}" style="display: inline-block; background-color: #22C55E; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">${ctaButton.text}</a>
            </div>
          ` : ''}
          <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #E5E7EB; font-size: 14px; color: #6B7280;">
            <p style="margin: 0;">Best regards,<br>Your Garden Center Team</p>
          </div>
        </div>
      </div>
    `;
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }
    
    // Here you would implement the test email sending logic
    toast.success(`Test email sent to ${testEmail}`);
  };

  const handleSwitchToAdvanced = () => {
    if (hasUnsavedChanges || message.trim() || subjectLine.trim()) {
      if (confirm('Switching to Advanced mode will convert your content. Any unsaved changes will be lost. Continue?')) {
        onSwitchToAdvanced();
      }
    } else {
      onSwitchToAdvanced();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Simple Email Builder</h1>
                <p className="text-gray-600 mt-1">Create a beautiful email in minutes</p>
              </div>
              {autoSaving && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Auto-saving...
                </div>
              )}
              {hasUnsavedChanges && !autoSaving && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  Unsaved changes
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleSwitchToAdvanced}
                className="gap-2"
              >
                <Paintbrush className="w-4 h-4" />
                Switch to Advanced
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={cn("grid gap-8", showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {/* Main Content */}
          <div className="space-y-8">
            {/* Email Summary Section */}
            <Card className="border-0 shadow-lg bg-white">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Mail className="w-5 h-5 text-primary" />
                  Email Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name" className="text-base font-medium">Campaign Name</Label>
                  <Input
                    id="campaign-name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., Spring Sale Announcement"
                    className="h-12 text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject-line" className="text-base font-medium">Subject Line</Label>
                  <Input
                    id="subject-line"
                    value={subjectLine}
                    onChange={(e) => setSubjectLine(e.target.value)}
                    placeholder="e.g., 🌸 Spring is here! Get 20% off everything"
                    className="h-12 text-lg"
                  />
                  <p className="text-sm text-gray-500">Keep it engaging and under 50 characters for best results</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">Recipients</Label>
                  <div className="flex flex-wrap gap-2">
                    {segments.length > 0 ? (
                      segments.map((segment) => (
                        <Badge key={segment.id} variant="secondary" className="gap-2 px-3 py-1">
                          <Users className="w-3 h-3" />
                          {segment.name}
                          <span className="text-xs opacity-70">({segment.customer_count} customers)</span>
                        </Badge>
                      ))
                    ) : selectedSegments.includes('all') ? (
                      <Badge variant="secondary" className="gap-2 px-3 py-1">
                        <Users className="w-3 h-3" />
                        All Customers
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-500">No segments selected</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Message Content Section */}
            <Card className="border-0 shadow-lg bg-white">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Message Content
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Cover Image */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Cover Image (Optional)</Label>
                  {coverImage ? (
                    <div className="relative group">
                      <img 
                        src={coverImage.url} 
                        alt={coverImage.alt}
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setCoverImage(null)}
                          className="gap-2"
                        >
                          <X className="w-4 h-4" />
                          Remove
                        </Button>
                      </div>
                      <div className="mt-2">
                        <Input
                          placeholder="Add alt text for accessibility"
                          value={coverImage.alt}
                          onChange={(e) => setCoverImage({...coverImage, alt: e.target.value})}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 mb-1">Click to upload cover image</p>
                      <p className="text-sm text-gray-500">PNG, JPG up to 10MB</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                {/* Message Editor */}
                <div className="space-y-4">
                  <Label htmlFor="message-content" className="text-base font-medium">Email Message</Label>
                  <RichTextEditor
                    content={message}
                    onChange={setMessage}
                    placeholder="Write your message here... Keep it personal and engaging!"
                    className="min-h-[250px]"
                  />
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{message.length} characters</span>
                    <span>Auto-saves every 3 seconds</span>
                  </div>
                </div>

                {/* Personalization Tokens */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Quick Insert</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {personalizationTokens.map((token) => {
                      const IconComponent = token.icon;
                      return (
                        <Button
                          key={token.value}
                          variant="outline"
                          size="sm"
                          onClick={() => insertToken(token.value)}
                          className="justify-start gap-2 h-auto py-3 hover:bg-primary/5"
                        >
                          <IconComponent className="h-4 w-4 text-primary" />
                          <span className="text-sm">{token.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="show-cta"
                      checked={showCtaButton}
                      onChange={(e) => setShowCtaButton(e.target.checked)}
                      className="w-4 h-4 text-primary"
                    />
                    <Label htmlFor="show-cta" className="text-base font-medium">Add Call-to-Action Button</Label>
                  </div>
                  
                  {showCtaButton && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="text-sm font-medium">Button Text</Label>
                        <Input
                          value={ctaButton?.text || ''}
                          onChange={(e) => setCtaButton(prev => ({...prev!, text: e.target.value}))}
                          placeholder="e.g., Shop Now"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Button Link</Label>
                        <Input
                          value={ctaButton?.url || ''}
                          onChange={(e) => setCtaButton(prev => ({...prev!, url: e.target.value}))}
                          placeholder="https://your-website.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Send Options Section */}
            <Card className="border-0 shadow-lg bg-white">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Send className="w-5 h-5 text-primary" />
                  Send Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup value={sendOption} onValueChange={(value: 'immediate' | 'scheduled') => setSendOption(value)}>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="immediate" id="immediate" />
                    <div className="flex-1">
                      <Label htmlFor="immediate" className="font-medium cursor-pointer">Send Immediately</Label>
                      <p className="text-sm text-gray-500">Email will be sent right after you click send</p>
                    </div>
                    <Zap className="w-5 h-5 text-orange-500" />
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value="scheduled" id="scheduled" />
                    <div className="flex-1">
                      <Label htmlFor="scheduled" className="font-medium cursor-pointer">Schedule for Later</Label>
                      <p className="text-sm text-gray-500">Choose a specific date and time</p>
                    </div>
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                </RadioGroup>

                {sendOption === 'scheduled' && (
                  <div className="pl-8 space-y-3">
                    <Label className="text-sm font-medium">Schedule Date & Time</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-12",
                            !scheduledDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, "PPP 'at' p") : "Pick a date and time"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <Separator />

                {/* Test Email */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Test Email</Label>
                  <div className="flex gap-3">
                    <Input
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="your-email@example.com"
                      className="flex-1"
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleSendTest}
                      disabled={!testEmail || !subjectLine || !message}
                      className="gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      Send Test
                    </Button>
                  </div>
                  <p className="text-sm text-gray-500">Preview how your email looks before sending to customers</p>
                </div>

                <Separator />

                {/* Final Send Button */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    className="flex-1 h-12 text-lg font-medium gap-2 bg-primary hover:bg-primary/90"
                    disabled={!campaignName || !subjectLine || !message}
                  >
                    <Send className="w-5 h-5" />
                    {sendOption === 'immediate' ? 'Send Email Now' : 'Schedule Email'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={saveContent}
                    disabled={autoSaving}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="space-y-6">
              <Card className="border-0 shadow-lg bg-white sticky top-24">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary" />
                      Live Preview
                    </CardTitle>
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <Button
                        variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPreviewMode('desktop')}
                        className="rounded-none border-0 gap-1"
                      >
                        <Monitor className="w-3 h-3" />
                        Desktop
                      </Button>
                      <Button
                        variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPreviewMode('mobile')}
                        className="rounded-none border-0 gap-1"
                      >
                        <Smartphone className="w-3 h-3" />
                        Mobile
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "bg-white shadow-xl rounded-lg border overflow-hidden",
                    previewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'
                  )}>
                    <div 
                      className="overflow-auto max-h-[600px]"
                      dangerouslySetInnerHTML={{ __html: generatePreviewHTML() }}
                    />
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-blue-900 mb-1">Preview Notes</p>
                        <p className="text-blue-700">
                          Personalization tokens show sample data. Real customer data will be used when sent.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};