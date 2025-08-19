
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
    setLoading(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(handleReset, 200);
  };

  const handleNext = () => {
    if (step === 1 && (useSandbox || domain.trim())) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
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
      await createEmailDomain(
        useSandbox ? undefined : domain.trim(), 
        reportEmail.trim() || undefined,
        useSandbox
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

          {step === 2 && (
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
                    <p>After creating the domain, you'll need to add DNS records to your domain provider to verify ownership and enable email sending.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? 'Creating...' : 'Create Domain'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
