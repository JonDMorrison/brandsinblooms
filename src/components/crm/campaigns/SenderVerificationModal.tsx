import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Shield, Zap, Mail, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { CelebrationEffect } from '@/components/ui/celebration-effect';
import { useEmailDomains } from '@/hooks/useEmailDomains';
import { DomainConnectWizard } from '@/components/crm/settings/DomainConnectWizard';
import { formatDistanceToNow } from 'date-fns';

interface SenderVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderConfig?: any;
}

export const SenderVerificationModal: React.FC<SenderVerificationModalProps> = ({
  open,
  onOpenChange,
  senderConfig
}) => {
  const { emailDomains, verifyEmailDomain, loading: domainsLoading, refetch } = useEmailDomains();
  const companyName = senderConfig?.companyName || 'Your Garden Center';
  const { toast } = useToast();
  
  const [isConfirmingQuickStart, setIsConfirmingQuickStart] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showDomainWizard, setShowDomainWizard] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Find domain states
  const activeDomain = emailDomains.find(d => d.status === 'active');
  const pendingDomain = emailDomains.find(d => ['pending', 'pending_dns', 'verifying'].includes(d.status));
  const isVerified = !!activeDomain || senderConfig?.isVerified;

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  };

  useEffect(() => {
    if (!open || !pendingDomain?.next_verify_at) {
      setCooldownSeconds(0);
      return;
    }

    const nextTs = new Date(pendingDomain.next_verify_at).getTime();

    const update = () => {
      const diffMs = Math.max(0, nextTs - Date.now());
      setCooldownSeconds(Math.ceil(diffMs / 1000));
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [open, pendingDomain?.id, pendingDomain?.next_verify_at]);

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      await verifyEmailDomain(domainId);
      await refetch();
    } catch {
      // verifyEmailDomain should toast errors; this catch prevents an unhandled rejection crash
      await refetch();
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleQuickStartConfirm = async () => {
    setIsConfirmingQuickStart(true);
    setShowCelebration(true);
    
    toast({
      title: "Quick Start Confirmed! ✅",
      description: "Your campaigns are ready to send immediately using our shared domain.",
    });
    
    setTimeout(() => {
      setIsConfirmingQuickStart(false);
      onOpenChange(false);
    }, 1500);
  };

  const handleDomainWizardClose = () => {
    setShowDomainWizard(false);
    refetch();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl p-0">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Sending Options
              </DialogTitle>
              <DialogDescription>
                Choose how you want to send your email campaigns
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 space-y-6">
            {/* Current Status */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Current Status</span>
                <Badge variant={isVerified ? "default" : "secondary"}>
                  {isVerified ? (
                    <>
                      <Shield className="h-3 w-3 mr-1" />
                      Custom Domain Verified
                    </>
                  ) : (
                    <>
                      <Mail className="h-3 w-3 mr-1" />
                      Using Shared Domain
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isVerified
                  ? `Emails sent from: ${senderConfig?.senderEmail || `mail@${activeDomain?.domain || senderConfig?.domain}`}`
                  : `Emails sent from: ${senderConfig?.senderEmail || 'noreply@bloomsuite.app'} on behalf of ${companyName}`
                }
              </p>
            </div>

            {/* Show active domain - all set! */}
            {activeDomain && (
              <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">You're all set!</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your domain <span className="font-medium text-foreground">{activeDomain.domain}</span> is 
                  verified and ready to send emails.
                </p>
                <Button 
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Continue with Campaign
                </Button>
              </div>
            )}

            {/* Show pending domain - check status */}
            {!activeDomain && pendingDomain && (
              <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                      Domain Verification Pending
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {pendingDomain.status === 'pending_dns' ? 'DNS Pending' : 'Verifying'}
                  </Badge>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <span className="font-medium">{pendingDomain.domain}</span> is being verified. 
                  DNS changes can take up to 48 hours to propagate.
                </p>
                {pendingDomain.last_verify_attempt_at && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Last checked {formatDistanceToNow(new Date(pendingDomain.last_verify_attempt_at))} ago
                    {pendingDomain.verify_attempts ? ` (${pendingDomain.verify_attempts} attempts)` : ''}
                  </p>
                )}
                {pendingDomain.next_verify_at && cooldownSeconds > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Next check available in {formatCooldown(cooldownSeconds)}
                  </p>
                )}
                {pendingDomain.last_verify_error && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 p-2 rounded">
                    {pendingDomain.last_verify_error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleVerifyDomain(pendingDomain.id)}
                    disabled={verifyingDomainId === pendingDomain.id || cooldownSeconds > 0}
                    className="flex-1"
                  >
                    {verifyingDomainId === pendingDomain.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {cooldownSeconds > 0
                          ? `Check again in ${formatCooldown(cooldownSeconds)}`
                          : 'Check Status Now'}
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      toast({
                        title: "Using shared domain for now",
                        description: "You can send campaigns immediately while your domain finishes verifying. We'll switch automatically once it's active.",
                      });
                      onOpenChange(false);
                    }}
                  >
                    Use Shared Domain for Now
                  </Button>
                </div>
              </div>
            )}

            {/* No domains - show setup options */}
            {!activeDomain && !pendingDomain && (
              <div className="grid gap-4">
                {/* Option 1: Quick Start (Shared Domain) */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Quick Start - Send Immediately</h3>
                    <Badge variant="outline" className="text-primary border-primary/30">
                      Ready Now
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span>Send campaigns right away</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span>No technical setup required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span>Uses our shared sending domain</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Emails will be sent from <code className="bg-muted px-1 rounded">noreply@bloomsuite.app</code> on behalf of {companyName}
                  </p>
                  <Button 
                    onClick={handleQuickStartConfirm}
                    className="w-full"
                    variant="outline"
                    disabled={isConfirmingQuickStart}
                  >
                    {isConfirmingQuickStart ? 'Confirming...' : 'Continue with Quick Start'}
                  </Button>
                </div>

                {/* Option 2: Custom Domain */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-secondary" />
                    <h3 className="font-semibold">Professional Setup - Custom Domain</h3>
                    <Badge variant="outline" className="text-secondary border-secondary/30">
                      Better Results
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-secondary" />
                      <span>Higher email deliverability</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-secondary" />
                      <span>Professional branding with your domain</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-secondary" />
                      <span>Better spam folder protection</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatic setup (2-3 minutes) • Emails sent from your own domain
                  </p>
                  <Button 
                    onClick={() => setShowDomainWizard(true)}
                    className="w-full"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Set Up Custom Domain
                  </Button>
                </div>
              </div>
            )}

            {/* Why This Matters - only show when not verified */}
            {!isVerified && (
              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                <h4 className="font-medium text-secondary mb-2">💡 Why does this matter?</h4>
                <div className="text-sm text-secondary/80 space-y-1">
                  <p>• <strong>Deliverability:</strong> Custom domains have better inbox placement rates</p>
                  <p>• <strong>Trust:</strong> Recipients see emails from your business domain</p>
                  <p>• <strong>Branding:</strong> Consistent professional appearance across all communications</p>
                  <p>• <strong>Control:</strong> Full ownership of your email reputation</p>
                </div>
              </div>
            )}

            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {isVerified ? (
                  <Link to="/domains" className="text-primary hover:underline">
                    Manage your domain settings →
                  </Link>
                ) : (
                  'You can always upgrade to custom domain setup later from Settings'
                )}
              </p>
            </div>
          </div>
        </DialogContent>
        
        {/* Celebration Effect */}
        <CelebrationEffect 
          isVisible={showCelebration}
          onComplete={() => setShowCelebration(false)}
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
        />
      </Dialog>

      {/* Entri-based Domain Connect Wizard */}
      <DomainConnectWizard 
        open={showDomainWizard} 
        onClose={handleDomainWizardClose} 
      />
    </>
  );
};
