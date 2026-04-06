import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { isValidEmail } from '@/lib/sendTestEmail';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { useFooterSettings } from '@/hooks/useFooterSettings';
import { generateNewsletterFooterHtml } from '@/utils/newsletterFooterHtml';
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
  campaignId?: string; // Optional campaign ID for tracking
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({
  isOpen,
  onClose,
  subject,
  content,
  campaignId
}) => {
  const { toast } = useToast();
  const { companyInfo } = useCompanyInfo();
  const { footerSettings, campaignOverrides } = useFooterSettings(campaignId);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Generate complete email HTML with footer (matches FullEmailPreview logic)
  const completeEmailHtml = useMemo(() => {
    const hasUnsubscribe = content.toLowerCase().includes('unsubscribe');
    const hasFooterStructure = content.includes('Manage Preferences') || content.includes('margin-top: 40px') || content.includes('max-width: 640px');
    const hasSocialIcons = content.includes('social-icons/');
    const hasFooter = hasUnsubscribe && (hasFooterStructure || hasSocialIcons);

    if (hasFooter) return content;

    const footerStyling = campaignOverrides?.footerStyling;
    const brandFooterColors = companyInfo?.brandFooterColors;

    const effectiveColors = {
      backgroundColor: footerStyling?.backgroundColor || brandFooterColors?.backgroundColor || companyInfo?.brandPrimaryColor || '#283024',
      textColor: footerStyling?.textColor || brandFooterColors?.textColor || '#F3F4F6',
      linkColor: footerStyling?.linkColor || brandFooterColors?.linkColor || '#E5BFA7',
      dividerColor: footerStyling?.dividerColor || brandFooterColors?.dividerColor || '#3D4A38',
      logoBackgroundColor: footerStyling?.logoBackgroundColor || brandFooterColors?.logoBackgroundColor || '#22C55E',
      logoTextColor: footerStyling?.logoTextColor || brandFooterColors?.logoTextColor || '#FFFFFF',
    };

    const footerHtml = generateNewsletterFooterHtml({
      logoUrl: companyInfo?.logoUrl,
      companyName: companyInfo?.name,
      addressLine1: companyInfo?.streetAddress,
      city: companyInfo?.city,
      region: companyInfo?.stateProvince,
      postalCode: companyInfo?.postalCode,
      country: companyInfo?.country,
      websiteUrl: companyInfo?.websiteUrl,
      email: companyInfo?.email,
      phone: companyInfo?.phone,
      facebookUrl: companyInfo?.facebookUrl,
      instagramUrl: companyInfo?.instagramUrl,
      tiktokUrl: companyInfo?.tiktokUrl,
      pinterestUrl: companyInfo?.pinterestUrl,
      youtubeUrl: companyInfo?.youtubeUrl,
      linkedinUrl: companyInfo?.linkedinUrl,
      unsubscribeUrl: '#unsubscribe',
      managePreferencesUrl: '#preferences',
      legalText: companyInfo?.footerLegalText || footerSettings?.complianceText,
      footerBackgroundColor: effectiveColors.backgroundColor,
      footerTextColor: effectiveColors.textColor,
      footerLinkColor: effectiveColors.linkColor,
      footerDividerColor: effectiveColors.dividerColor,
      footerLogoBackgroundColor: effectiveColors.logoBackgroundColor,
      footerLogoTextColor: effectiveColors.logoTextColor,
      brandPrimaryColor: companyInfo?.brandPrimaryColor,
    });

    if (content.includes('</body>')) {
      return content.replace('</body>', `${footerHtml}</body>`);
    } else if (content.includes('</html>')) {
      return content.replace('</html>', `${footerHtml}</html>`);
    }
    return `${content}${footerHtml}`;
  }, [content, companyInfo, footerSettings, campaignOverrides]);

  const sendTestEmail = async () => {
    const email = testEmail.trim();

    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter an email address for the test",
        variant: "destructive"
      });
      return;
    }

    if (!isValidEmail(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setSendingTest(true);

    try {
      // Use send-test-email-v2 for full personalization and merge tag support
      const { data, error } = await supabase.functions.invoke('send-test-email-v2', {
        body: {
          toEmail: email,
          subject: subject || 'Test Email Campaign',
          html: content, // Raw content — server adds footer
          campaignId,
          sampleCustomer: {
            first_name: 'Jane',
            last_name: 'Gardener',
            email: 'jane@example.com',
            phone: '(555) 123-4567',
          },
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Test Email Sent!",
          description: `Test email sent to ${email}`
        });
        setTestEmail('');
      } else {
        toast({
          title: "Failed to Send Test Email",
          description: data?.error || 'Unknown error',
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred. Please try again.",
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
                  srcDoc={completeEmailHtml}
                  className="w-full h-full border-0"
                  style={{ 
                    minHeight: '600px',
                    height: '100%'
                  }}
                  title="Email Preview"
                  sandbox="allow-same-origin"
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