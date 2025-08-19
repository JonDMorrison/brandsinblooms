
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Globe, Mail, ArrowRight, TestTube } from 'lucide-react';
import { useEmailDomains } from '@/hooks/useEmailDomains';
import { toast } from 'sonner';

interface EmailDomainWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EmailDomainWizard = ({ open, onOpenChange }: EmailDomainWizardProps) => {
  const { createEmailDomain, getSandboxConfig } = useEmailDomains();
  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [useSandbox, setUseSandbox] = useState(false);
  const [provider, setProvider] = useState<'cloudflare' | 'domain_connect' | 'manual'>('manual');
  const [cloudflareToken, setCloudflareToken] = useState('');
  const [sandboxConfig, setSandboxConfig] = useState<any>({ enabled: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadSandboxConfig();
    }
  }, [open]);

  const loadSandboxConfig = async () => {
    try {
      const config = await getSandboxConfig();
      setSandboxConfig(config);
    } catch (error) {
      console.error('Failed to load sandbox config:', error);
    }
  };

  const handleReset = () => {
    setStep(1);
    setDomain('');
    setReportEmail('');
    setUseSandbox(false);
    setProvider('manual');
    setCloudflareToken('');
    setLoading(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(handleReset, 200);
  };

  const handleNext = () => {
    if (step === 1 && (useSandbox || domain.trim())) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!useSandbox && !domain.trim()) {
      toast.error('Domain is required');
      return;
    }

    try {
      setLoading(true);
      const providerAuth = provider === 'cloudflare' && cloudflareToken ? 
        { cloudflareToken } : undefined;
        
      const finalProvider = useSandbox ? 'cloudflare' : provider;
      
      await createEmailDomain(
        useSandbox ? undefined : domain.trim(), 
        reportEmail.trim() || undefined,
        useSandbox,
        finalProvider,
        providerAuth
      );
      handleClose();
    } catch (error: any) {
      console.error('Error creating domain:', error);
      // Toast is handled in the hook
    } finally {
      setLoading(false);
    }
  };

  const generateSandboxPreview = () => {
    if (!sandboxConfig.rootDomain) return '';
    const randomId = Math.random().toString(36).substring(2, 10);
    return `${randomId}.${sandboxConfig.rootDomain}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Add Email Domain
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              1
            </div>
            <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-green-200' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              2
            </div>
            <div className={`flex-1 h-0.5 ${step >= 3 ? 'bg-green-200' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 3 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              3
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Domain Configuration</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter the domain you want to use for sending emails from your campaigns.
                </p>
              </div>

              {sandboxConfig.enabled && (
                <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id="sandbox"
                      checked={useSandbox}
                      onCheckedChange={(checked) => setUseSandbox(checked as boolean)}
                    />
                    <Label htmlFor="sandbox" className="text-sm font-medium flex items-center gap-2">
                      <TestTube className="w-4 h-4" />
                      Use sandbox test domain instead
                    </Label>
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">TEST</Badge>
                  </div>
                  {useSandbox && (
                    <div className="mt-2 p-2 bg-white rounded border text-xs text-gray-600">
                      <div className="font-mono bg-gray-100 px-2 py-1 rounded text-xs mb-1">
                        Preview: {generateSandboxPreview()}
                      </div>
                      <p className="text-blue-700">
                        ✨ DNS records will be applied automatically for instant testing
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!useSandbox && (
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain *</Label>
                  <Input
                    id="domain"
                    placeholder="e.g., mail.yourdomain.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    Use a subdomain like "mail.yourdomain.com" for better deliverability
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleNext} 
                  disabled={!useSandbox && !domain.trim()}
                  className="flex items-center gap-2"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && !useSandbox && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Provider Selection</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose how you want to apply DNS records for your domain.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3">
                  {/* Domain Connect Option */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      provider === 'domain_connect' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setProvider('domain_connect')}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="provider"
                        checked={provider === 'domain_connect'}
                        onChange={() => setProvider('domain_connect')}
                        className="text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Automatic Setup (Domain Connect)</div>
                        <div className="text-sm text-gray-600">
                          Works with GoDaddy, Namecheap, and other major registrars
                        </div>
                        <Badge variant="secondary" className="mt-1 text-xs bg-green-100 text-green-800">
                          Recommended
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Cloudflare Option */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      provider === 'cloudflare' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setProvider('cloudflare')}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="provider"
                        checked={provider === 'cloudflare'}
                        onChange={() => setProvider('cloudflare')}
                        className="text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Cloudflare API</div>
                        <div className="text-sm text-gray-600">
                          If your domain uses Cloudflare for DNS
                        </div>
                      </div>
                    </div>
                    
                    {provider === 'cloudflare' && (
                      <div className="mt-3 pl-6">
                        <Label htmlFor="cfToken" className="text-sm">Cloudflare API Token</Label>
                        <Input
                          id="cfToken"
                          type="password"
                          placeholder="Your Cloudflare API token with Zone:Edit permissions"
                          value={cloudflareToken}
                          onChange={(e) => setCloudflareToken(e.target.value)}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Create one at: Cloudflare Dashboard → My Profile → API Tokens
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Manual Option */}
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      provider === 'manual' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setProvider('manual')}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="provider"
                        checked={provider === 'manual'}
                        onChange={() => setProvider('manual')}
                        className="text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium">Manual DNS Setup</div>
                        <div className="text-sm text-gray-600">
                          I'll add the DNS records myself
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button 
                  onClick={handleNext}
                  disabled={provider === 'cloudflare' && !cloudflareToken.trim()}
                  className="flex items-center gap-2"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {(step === 2 && useSandbox) || step === 3 ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">DMARC Reports</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure where DMARC authentication reports should be sent.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportEmail" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Send DMARC reports to (optional)
                </Label>
                <Input
                  id="reportEmail"
                  type="email"
                  placeholder="reports@yourdomain.com"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  className="w-full"
                />
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800">
                    💡 We'll still receive copies at our BloomSuite DMARC inbox for monitoring. 
                    This additional email is for your own tracking and compliance needs.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium mb-1">Next Steps:</p>
                    {useSandbox ? (
                      <p>Your sandbox domain will be ready immediately with automatic DNS setup!</p>
                    ) : provider === 'domain_connect' ? (
                      <p>After creating the domain, you'll be redirected to your registrar to authorize DNS changes.</p>
                    ) : provider === 'cloudflare' ? (
                      <p>DNS records will be applied automatically to your Cloudflare zone.</p>
                    ) : (
                      <p>After creating the domain, you'll need to add DNS records to your domain provider manually.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                {!useSandbox && (
                  <Button variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                )}
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? 'Creating...' : 'Create Domain'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
