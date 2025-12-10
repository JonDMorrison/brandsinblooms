import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { sendCampaignTestEmail, isValidEmail } from '@/lib/sendTestEmail';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { useFooterSettings } from '@/hooks/useFooterSettings';
import { generateNewsletterFooterHtml } from '@/utils/newsletterFooterHtml';
import { cn } from '@/lib/utils';
import { 
  Monitor, 
  Smartphone, 
  Send, 
  Loader2,
  Mail,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface FullEmailPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  content: string;
  campaignId?: string;
  senderName?: string;
  senderEmail?: string;
}

export const FullEmailPreview: React.FC<FullEmailPreviewProps> = ({
  isOpen,
  onClose,
  subject,
  content,
  campaignId,
  senderName,
  senderEmail
}) => {
  const { toast } = useToast();
  const { companyInfo } = useCompanyInfo();
  const { footerSettings, campaignOverrides } = useFooterSettings(campaignId);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Generate the complete email HTML with footer
  const completeEmailHtml = useMemo(() => {
    // Check if content already has a proper footer
    const hasFooter = content.includes('Unsubscribe') && 
                     (content.includes('viewBox="0 0 24 24"') || content.includes('footer'));

    if (hasFooter) {
      return content;
    }

    // Generate footer using company info
    const footerStyling = campaignOverrides?.footerStyling;
    const brandFooterColors = companyInfo?.brandFooterColors;

    const effectiveColors = {
      backgroundColor: 
        footerStyling?.backgroundColor || 
        brandFooterColors?.backgroundColor || 
        companyInfo?.brandPrimaryColor ||
        '#283024',
      textColor: 
        footerStyling?.textColor || 
        brandFooterColors?.textColor ||
        '#F3F4F6',
      linkColor: 
        footerStyling?.linkColor || 
        brandFooterColors?.linkColor ||
        '#E5BFA7',
      dividerColor: 
        footerStyling?.dividerColor || 
        brandFooterColors?.dividerColor ||
        '#3D4A38',
      logoBackgroundColor: 
        footerStyling?.logoBackgroundColor || 
        brandFooterColors?.logoBackgroundColor ||
        '#22C55E',
      logoTextColor: 
        footerStyling?.logoTextColor || 
        brandFooterColors?.logoTextColor ||
        '#FFFFFF',
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

    // Combine content with footer
    // If content ends with </body> or </html>, insert footer before it
    if (content.includes('</body>')) {
      return content.replace('</body>', `${footerHtml}</body>`);
    } else if (content.includes('</html>')) {
      return content.replace('</html>', `${footerHtml}</html>`);
    } else {
      return `${content}${footerHtml}`;
    }
  }, [content, companyInfo, footerSettings, campaignOverrides]);

  // Check what social links are present
  const socialLinksStatus = useMemo(() => {
    return {
      facebook: !!companyInfo?.facebookUrl,
      instagram: !!companyInfo?.instagramUrl,
      tiktok: !!companyInfo?.tiktokUrl,
      pinterest: !!companyInfo?.pinterestUrl,
      youtube: !!companyInfo?.youtubeUrl,
      linkedin: !!companyInfo?.linkedinUrl,
    };
  }, [companyInfo]);

  const hasSocialLinks = Object.values(socialLinksStatus).some(Boolean);

  const sendTestEmailHandler = async () => {
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
      const result = await sendCampaignTestEmail({
        email,
        subject: subject || 'Test Email Campaign',
        content: completeEmailHtml, // Use the complete email with footer
        campaignId: campaignId
      });

      if (result.success) {
        toast({
          title: "Test Email Sent!",
          description: result.message
        });
        setTestEmail('');
      } else {
        toast({
          title: "Failed to Send Test Email",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Full Email Preview
              <Badge variant="outline" className="ml-2">
                Exact Send Preview
              </Badge>
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="flex flex-col h-full max-h-[calc(90vh-120px)]">
          {/* Controls Bar */}
          <div className="flex items-center justify-between p-3 border-b bg-background">
            {/* View Mode Toggle */}
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
            
            {/* Test Email Section */}
            <div className="flex items-center gap-2">
              <Label htmlFor="test-email" className="text-sm whitespace-nowrap">Send test to:</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-44 h-8"
              />
              <Button 
                onClick={sendTestEmailHandler} 
                disabled={sendingTest}
                size="sm"
              >
                {sendingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Email Header Info */}
          <div className="p-3 bg-muted/20 border-b">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">From:</span>
                <p className="truncate">{senderName || companyInfo?.name} &lt;{senderEmail || 'noreply@bloomsuite.email'}&gt;</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Subject:</span>
                <p className="truncate">{subject || 'No subject line'}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">To:</span>
                <p className="truncate">recipient@example.com</p>
              </div>
            </div>
          </div>

          {/* Social Links Status Banner */}
          <div className="px-3 py-2 border-b bg-background">
            <div className="flex items-center gap-2 text-xs">
              {hasSocialLinks ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-muted-foreground">Social icons in footer:</span>
                  <div className="flex gap-1">
                    {socialLinksStatus.facebook && <Badge variant="secondary" className="text-[10px] px-1 py-0">Facebook</Badge>}
                    {socialLinksStatus.instagram && <Badge variant="secondary" className="text-[10px] px-1 py-0">Instagram</Badge>}
                    {socialLinksStatus.tiktok && <Badge variant="secondary" className="text-[10px] px-1 py-0">TikTok</Badge>}
                    {socialLinksStatus.pinterest && <Badge variant="secondary" className="text-[10px] px-1 py-0">Pinterest</Badge>}
                    {socialLinksStatus.youtube && <Badge variant="secondary" className="text-[10px] px-1 py-0">YouTube</Badge>}
                    {socialLinksStatus.linkedin && <Badge variant="secondary" className="text-[10px] px-1 py-0">LinkedIn</Badge>}
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-muted-foreground">No social links configured.</span>
                  <a href="/profile/contact-footer" className="text-primary hover:underline">
                    Add social links →
                  </a>
                </>
              )}
            </div>
          </div>
          
          {/* Email Preview */}
          <div className="flex-1 overflow-auto p-4 bg-muted/50">
            <div 
              className={cn(
                "mx-auto bg-white shadow-lg transition-all duration-300 rounded-lg overflow-hidden",
                viewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'
              )}
            >
              <iframe
                srcDoc={completeEmailHtml}
                className="w-full border-0"
                style={{ 
                  minHeight: '600px',
                  height: viewMode === 'mobile' ? '700px' : '800px'
                }}
                title="Full Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-3 border-t bg-muted/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <Mail className="h-3 w-3 inline-block mr-1" />
              This preview shows exactly what recipients will see, including the dynamically generated footer with social icons.
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Preview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
