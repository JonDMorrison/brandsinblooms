import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  Copy, 
  Mail, 
  Shield, 
  HelpCircle,
  Loader2,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { useSenderConfiguration } from '@/hooks/useSenderConfiguration';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  description: string;
  verified: boolean;
}

const EmailDomainSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { senderConfig } = useSenderConfiguration();
  const [currentStep, setCurrentStep] = useState(1);
  const [senderEmail, setSenderEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [emailAuthStatus, setEmailAuthStatus] = useState<'pending' | 'verified' | 'failed'>('pending');

  useEffect(() => {
    loadCurrentSettings();
  }, [user?.id]);

  const loadCurrentSettings = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('custom_sender_email, email_domain, email_auth_status, dns_records_verified')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data?.custom_sender_email) {
        setSenderEmail(data.custom_sender_email);
        const emailDomain = data.custom_sender_email.split('@')[1];
        setDomain(emailDomain);
        setEmailAuthStatus((data.email_auth_status as 'pending' | 'verified' | 'failed') || 'pending');
        
        if (data.email_auth_status === 'verified') {
          setCurrentStep(4); // Jump to success step
        } else if (data.custom_sender_email) {
          setCurrentStep(2); // Jump to DNS setup
          generateDNSRecords(emailDomain);
        }
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async () => {
    if (!validateEmail(senderEmail)) {
      toast({ title: 'Error', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    setIsValidating(true);
    const emailDomain = senderEmail.split('@')[1];
    setDomain(emailDomain);

    try {
      // Save the sender email to database
      const { error } = await supabase
        .from('company_profiles')
        .update({
          custom_sender_email: senderEmail,
          email_domain: emailDomain,
          email_auth_status: 'pending'
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      // Generate DNS records for this domain
      generateDNSRecords(emailDomain);
      setCurrentStep(2);
      toast({ title: 'Success', description: 'Email saved! Let\'s set up your DNS records.' });
    } catch (error) {
      console.error('Error saving email:', error);
      toast({ title: 'Error', description: 'Failed to save email. Please try again.', variant: 'destructive' });
    } finally {
      setIsValidating(false);
    }
  };

  const generateDNSRecords = (emailDomain: string) => {
    const records: DNSRecord[] = [
      {
        type: 'TXT',
        name: emailDomain,
        value: 'v=spf1 include:resend.email ~all',
        description: 'SPF record authorizes Resend to send emails from your domain',
        verified: false
      },
      {
        type: 'CNAME',
        name: `selector1._domainkey.${emailDomain}`,
        value: 'selector1.domainkey.resend.email',
        description: 'DKIM record provides email authentication and prevents spoofing',
        verified: false
      },
      {
        type: 'TXT',
        name: `_dmarc.${emailDomain}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${emailDomain}`,
        description: 'DMARC policy helps protect your domain from email abuse',
        verified: false
      }
    ];
    setDnsRecords(records);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Success', description: 'Copied to clipboard!' });
  };

  const verifyDNSRecords = async () => {
    setIsVerifying(true);
    try {
      // Call edge function to verify DNS records
      const { data, error } = await supabase.functions.invoke('verify-email-domain', {
        body: { domain, records: dnsRecords }
      });

      if (error) throw error;

      const verificationResults = data.results || [];
      const updatedRecords = dnsRecords.map((record, index) => ({
        ...record,
        verified: verificationResults[index]?.verified || false
      }));

      setDnsRecords(updatedRecords);

      const allVerified = updatedRecords.every(record => record.verified);
      
      if (allVerified) {
        // Update database with verified status
        await supabase
          .from('company_profiles')
          .update({
            email_auth_status: 'verified',
            dns_records_verified: true,
            email_auth_setup_at: new Date().toISOString()
          })
          .eq('user_id', user?.id);

        setEmailAuthStatus('verified');
        setCurrentStep(4);
        toast({ title: '🎉 Success', description: 'Domain verified! Your emails will now have improved deliverability.' });
      } else {
        toast({ title: 'Error', description: 'Some DNS records are not yet propagated. Please wait a few minutes and try again.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error verifying DNS:', error);
      toast({ title: 'Error', description: 'Failed to verify DNS records. Please try again.', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const sendTestEmail = async () => {
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: { 
          senderEmail,
          testRecipient: user?.email 
        }
      });

      if (error) {
        // Check if it's a configuration error
        if (error.message?.includes('RESEND_API_KEY')) {
          toast({ 
            title: 'Configuration Required', 
            description: 'Please add RESEND_API_KEY in Supabase Edge Functions → Secrets to send emails.',
            variant: 'destructive'
          });
        } else {
          throw error;
        }
        return;
      }
      
      toast({ title: 'Success', description: 'Test email sent! Check your inbox.' });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({ title: 'Error', description: 'Failed to send test email. Please try again.', variant: 'destructive' });
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label htmlFor="senderEmail">Preferred Sender Email</Label>
        <Input
          id="senderEmail"
          type="email"
          placeholder="hello@yourgardenstore.com"
          value={senderEmail}
          onChange={(e) => setSenderEmail(e.target.value)}
          className="text-lg"
        />
        <p className="text-sm text-muted-foreground">
          This will be the "From" address for all your email campaigns. Make sure you own this domain.
        </p>
      </div>

      <div className="flex space-x-3">
        <Button 
          onClick={handleEmailSubmit}
          disabled={!senderEmail || isValidating}
          className="flex-1"
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            'Continue Setup'
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/crm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CRM
          </Link>
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Add these DNS records to your domain provider to verify ownership and improve email deliverability.
          <div className="mt-3 space-y-2">
            <p><strong>Common providers:</strong></p>
            <div className="flex flex-wrap gap-2">
              <a href="https://www.godaddy.com/help/manage-dns-680" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">GoDaddy DNS</a>
              <span className="text-gray-300">•</span>
              <a href="https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">Namecheap DNS</a>
              <span className="text-gray-300">•</span>
              <a href="https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">Cloudflare DNS</a>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">💡 Quick Tips</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>SPF:</strong> If you already have an SPF record, add <code>include:resend.email</code> to your existing record instead of creating a new one</li>
          <li>• <strong>DKIM:</strong> The CNAME host must match exactly - don't include your domain twice</li>
          <li>• <strong>Propagation:</strong> DNS changes typically take 5-30 minutes, but can take up to 24-48 hours</li>
          <li>• Use <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer" className="underline">DNSChecker.org</a> to verify your records globally</li>
        </ul>
      </div>

      <div className="space-y-4">
        {dnsRecords.map((record, index) => (
          <Card key={index} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">{record.type}</Badge>
                  <span className="font-medium">{record.type} Record</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{record.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {record.verified ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name/Host</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="flex-1 p-2 bg-muted rounded text-sm">{record.name}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(record.name)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Value</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="flex-1 p-2 bg-muted rounded text-sm break-all">{record.value}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(record.value)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Troubleshooting:</strong> If verification fails, wait 5-30 minutes for DNS propagation and try again. 
          Check that you don't have duplicate SPF records (only one per domain is allowed).
        </AlertDescription>
      </Alert>

      <div className="flex space-x-3">
        <Button 
          onClick={verifyDNSRecords}
          disabled={isVerifying}
          className="flex-1"
        >
          {isVerifying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking DNS Records...
            </>
          ) : (
            'Verify DNS Records'
          )}
        </Button>
        <Button variant="outline" onClick={() => setCurrentStep(1)}>
          Back
        </Button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-green-800 mb-2">
          🎉 You're verified!
        </h3>
        <p className="text-green-700">
          Emails will now be sent from <strong>{senderEmail}</strong> with improved deliverability and trust.
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
        <h4 className="font-medium text-green-800 mb-2">✅ What's now enabled</h4>
        <ul className="text-sm text-green-700 space-y-1 text-left">
          <li>• Campaigns sent from <strong>{senderEmail}</strong></li>
          <li>• Professional branding (no "via BloomSuite" messages)</li>
          <li>• Improved email deliverability and inbox placement</li>
          <li>• Lower spam folder placement</li>
          <li>• Full DKIM/SPF authentication for trust</li>
        </ul>
      </div>

      <div className="flex space-x-3">
        <Button onClick={sendTestEmail} variant="outline">
          <Mail className="h-4 w-4 mr-2" />
          Send Test Email
        </Button>
        <Button asChild className="flex-1">
          <Link to="/crm/campaigns/new">
            Create Your First Campaign
          </Link>
        </Button>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Choose Your Sender Email';
      case 2: return 'Configure DNS Records';
      case 4: return 'Setup Complete!';
      default: return 'Email Domain Setup';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-cyan-50/30">
      <div className="container mx-auto p-6 max-w-4xl">
        
        {/* About Sending Information */}
        <Card className="mb-8 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Mail className="h-5 w-5" />
              About Email Sending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!senderConfig?.isVerified ? (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <div className="space-y-3">
                    <p className="font-medium">Email Service Configuration Required</p>
                    <p className="text-sm">
                      To send campaigns, you need to configure your email service. Choose one option:
                    </p>
                    <div className="space-y-2 text-sm">
                      <p><strong>Option 1 (Recommended):</strong> Set up your custom domain below for professional branding</p>
                      <p><strong>Option 2:</strong> Add <code className="bg-orange-100 px-1 rounded">RESEND_API_KEY</code> in Supabase Edge Functions → Secrets for quick setup</p>
                    </div>
                    <div className="mt-3">
                      <a 
                        href="https://supabase.com/dashboard/project/udldmkqwnxhdeztyqcau/settings/functions" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-orange-700 underline hover:text-orange-900"
                      >
                        → Configure API Key in Supabase
                      </a>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <p><strong>Sending via Custom Domain:</strong> Your campaigns will be sent from <strong>{senderConfig.senderEmail || senderEmail}</strong> with professional branding and improved deliverability.</p>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">🔄 Current Sending Method</h4>
              {senderConfig?.isVerified ? (
                <p className="text-sm text-blue-700">
                  <strong>Custom Domain:</strong> Professional sending from your verified domain with full authentication.
                </p>
              ) : (
                <p className="text-sm text-blue-700">
                  <strong>Shared Domain:</strong> Campaigns are sent via BloomSuite's shared sending domain until you complete domain setup or add API key.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="text-center space-y-4 mb-8">
          <div className="flex items-center justify-center space-x-3">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Custom Domain Email Setup
              </h1>
              <p className="text-muted-foreground">
                Send campaigns from your own domain for better deliverability
              </p>
            </div>
          </div>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl">{getStepTitle()}</CardTitle>
            <div className="flex space-x-2">
              {[1, 2, 4].map((step) => (
                <div
                  key={step}
                  className={`h-2 flex-1 rounded-full ${
                    step <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 4 && renderStep4()}
          </CardContent>
        </Card>

        <div className="mt-8 text-center space-y-4">
          <div className="text-sm text-muted-foreground">
            <p><strong>Need help?</strong> DNS setup can be tricky. Contact support if you get stuck.</p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/crm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to CRM Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmailDomainSetup;