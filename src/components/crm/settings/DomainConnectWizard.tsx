import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, ArrowRight, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { useEmailDomainManagement } from '@/hooks/useEmailDomainManagement';

interface DomainConnectWizardProps {
  open: boolean;
  onClose: () => void;
}

type WizardStep = 'enter_domain' | 'provisioning' | 'dns_pending' | 'complete';

export const DomainConnectWizard: React.FC<DomainConnectWizardProps> = ({ open, onClose }) => {
  const { provisionDomain } = useEmailDomainManagement();
  const [step, setStep] = useState<WizardStep>('enter_domain');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisionedData, setProvisionedData] = useState<any>(null);

  const validateDomain = (value: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    return domainRegex.test(value);
  };

  const handleSubmit = async () => {
    setError(null);
    
    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
    
    if (!validateDomain(cleanDomain)) {
      setError('Please enter a valid domain (e.g., example.com)');
      return;
    }

    setLoading(true);
    setStep('provisioning');

    const result = await provisionDomain(cleanDomain);
    
    setLoading(false);

    if (result.success) {
      setProvisionedData(result.data);
      setStep('dns_pending');
    } else {
      setStep('enter_domain');
      setError(result.error || 'Failed to provision domain');
    }
  };

  const handleClose = () => {
    setStep('enter_domain');
    setDomain('');
    setError(null);
    setProvisionedData(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Connect Your Domain
          </DialogTitle>
          <DialogDescription>
            Send emails from your own domain for better deliverability and brand recognition.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Enter Domain */}
        {step === 'enter_domain' && (
          <div className="space-y-4 py-4">
            {/* Why This Matters */}
            <Alert className="bg-primary/5 border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs">
                <span className="font-medium">Why connect your domain?</span> Emails sent from your own domain 
                (like news@yourbusiness.com) have better deliverability than shared addresses, and recipients 
                recognize and trust your brand.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="domain">Your Domain</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <p className="text-xs text-muted-foreground">
                Enter your domain without https:// or www
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <span className="font-medium">What you'll need:</span> Access to your domain's DNS settings 
                (Cloudflare, GoDaddy, Namecheap, etc.). The setup takes about 5-10 minutes, then DNS 
                propagation can take up to 48 hours (usually much faster).
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 2: Provisioning */}
        {step === 'provisioning' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Setting up your domain...</p>
              <p className="text-sm text-muted-foreground">This may take a few seconds</p>
            </div>
          </div>
        )}

        {/* Step 3: DNS Pending */}
        {step === 'dns_pending' && (
          <div className="space-y-4 py-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Domain registered successfully! Now add the DNS records to verify ownership.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-medium">Next Steps:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Go to your DNS provider (Cloudflare, GoDaddy, etc.)</li>
                <li>Add the DNS records shown in the domain settings</li>
                <li>Wait for DNS propagation (up to 48 hours, usually faster)</li>
                <li>Click "Check DNS" to verify your records</li>
              </ol>
            </div>

            <p className="text-xs text-muted-foreground">
              Once verified, your domain will go through a warmup period to build sending reputation.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'enter_domain' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === 'dns_pending' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
