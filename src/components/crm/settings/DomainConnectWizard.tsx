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
import { Globe, ArrowRight, Loader2, Info, CheckCircle2, Zap, Settings, Sparkles } from 'lucide-react';
import { useEmailDomainManagement } from '@/hooks/useEmailDomainManagement';
import { useEntriConnect } from '@/hooks/useEntriConnect';
import { useTenant } from '@/hooks/useTenant';

interface DomainConnectWizardProps {
  open: boolean;
  onClose: () => void;
}

type WizardStep = 'enter_domain' | 'choose_method' | 'provisioning' | 'dns_pending' | 'entri_success' | 'complete';

export const DomainConnectWizard: React.FC<DomainConnectWizardProps> = ({ open, onClose }) => {
  const { provisionDomain, refetch } = useEmailDomainManagement();
  const { openEntriSetup, isEntriConfigured, isLoading: entriLoading } = useEntriConnect();
  const { tenant } = useTenant();
  
  const [step, setStep] = useState<WizardStep>('enter_domain');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisionedData, setProvisionedData] = useState<any>(null);
  const [entriProvider, setEntriProvider] = useState<string | null>(null);
  const [isEntriModalOpen, setIsEntriModalOpen] = useState(false);

  const validateDomain = (value: string): boolean => {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    return domainRegex.test(value);
  };

  const cleanDomainInput = (value: string): string => {
    return value.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
  };

  const handleContinueToMethod = () => {
    setError(null);
    
    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }

    const cleanDomain = cleanDomainInput(domain);
    
    if (!validateDomain(cleanDomain)) {
      setError('Please enter a valid domain (e.g., example.com)');
      return;
    }

    setDomain(cleanDomain);
    setStep('choose_method');
  };

  const handleEntriSetup = async () => {
    if (!tenant?.id) {
      setError('No workspace context');
      return;
    }

    const cleanDomain = cleanDomainInput(domain);
    
    // Hide our dialog while Entri modal is active
    setIsEntriModalOpen(true);
    
    openEntriSetup(
      cleanDomain,
      tenant.id,
      undefined, // Use default DNS records
      // onSuccess
      () => {
        setIsEntriModalOpen(false);
        refetch();
        setStep('entri_success');
      },
      // onCancel - fall back to manual
      () => {
        setIsEntriModalOpen(false);
        setStep('choose_method');
      }
    );
  };

  const handleManualSetup = async () => {
    setError(null);
    setLoading(true);
    setStep('provisioning');

    const cleanDomain = cleanDomainInput(domain);
    const result = await provisionDomain(cleanDomain);
    
    setLoading(false);

    if (result.success) {
      setProvisionedData(result.data);
      setStep('dns_pending');
    } else {
      setStep('choose_method');
      setError(result.error || 'Failed to provision domain');
    }
  };

  const handleClose = () => {
    setStep('enter_domain');
    setDomain('');
    setError(null);
    setProvisionedData(null);
    setEntriProvider(null);
    setIsEntriModalOpen(false);
    onClose();
  };

  // Don't render our dialog when Entri modal is active to prevent z-index conflicts
  if (isEntriModalOpen) {
    return null;
  }

  const getStepNumber = () => {
    switch (step) {
      case 'enter_domain': return 1;
      case 'choose_method': return 2;
      case 'provisioning': 
      case 'dns_pending':
      case 'entri_success':
      case 'complete': return 3;
      default: return 1;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center justify-between mb-1">
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Connect Your Domain
            </DialogTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Step {getStepNumber()}</span>
              <span>/</span>
              <span>3</span>
            </div>
          </div>
          <DialogDescription>
            Send emails from your own domain for better deliverability and brand recognition.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Enter Domain */}
        {step === 'enter_domain' && (
          <div className="space-y-4 py-4">
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
                onKeyDown={(e) => e.key === 'Enter' && handleContinueToMethod()}
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
          </div>
        )}

        {/* Step 2: Choose Setup Method */}
        {step === 'choose_method' && (
          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">
                Setting up <span className="font-medium text-foreground">{domain}</span>
              </p>
            </div>

            {/* Automatic Setup Option */}
            {isEntriConfigured && (
              <div 
                className="relative border-2 border-primary/20 rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer bg-primary/5"
                onClick={handleEntriSetup}
              >
                <div className="absolute -top-2.5 left-3 px-2 bg-background">
                  <span className="text-xs font-medium text-primary flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Recommended
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">Automatic Setup via Entri</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Securely connect to your DNS provider for one-click setup. Works with GoDaddy, Cloudflare, Namecheap, and 50+ providers.
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    disabled={entriLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEntriSetup();
                    }}
                  >
                    {entriLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Set Up'
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border"></div>
              <span className="mx-3 text-xs text-muted-foreground">or</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            {/* Manual Setup Option */}
            <div 
              className="border rounded-lg p-4 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={handleManualSetup}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-sm">Manual Setup</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get DNS records to add manually. Best for advanced users or unsupported providers.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualSetup();
                  }}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Configure'
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <span className="font-medium">What's configured:</span> SPF (sender verification), 
                DKIM (email signing), and DMARC (policy enforcement) records for email authentication.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step 3: Provisioning */}
        {step === 'provisioning' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">Setting up your domain...</p>
              <p className="text-sm text-muted-foreground">This may take a few seconds</p>
            </div>
          </div>
        )}

        {/* Step 4: DNS Pending (Manual) */}
        {step === 'dns_pending' && (
          <div className="space-y-4 py-4">
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Domain registered! Now add the DNS records to verify ownership.
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

        {/* Step 5: Entri Success */}
        {step === 'entri_success' && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">DNS Configured Successfully!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your DNS records have been automatically applied{entriProvider ? ` via ${entriProvider}` : ''}.
              </p>
            </div>

            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                <span className="font-medium">What happens next:</span> DNS changes typically propagate within 
                5-30 minutes. We'll automatically verify your domain and start the warmup process to build 
                sending reputation.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-medium">Warmup Period:</p>
              <p className="text-xs text-muted-foreground">
                New domains start with limited sending capacity that gradually increases over 2-3 weeks. 
                This protects your domain reputation and ensures high deliverability.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'enter_domain' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleContinueToMethod}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}

          {step === 'choose_method' && (
            <Button variant="outline" onClick={() => setStep('enter_domain')}>
              Back
            </Button>
          )}

          {(step === 'dns_pending' || step === 'entri_success') && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
