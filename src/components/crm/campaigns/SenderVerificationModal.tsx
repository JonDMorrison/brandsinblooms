import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Shield, Zap, Settings, Mail, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DomainConnectWizard } from '@/components/domains/DomainConnectWizard';
import { useToast } from '@/hooks/use-toast';
import { CelebrationEffect } from '@/components/ui/celebration-effect';

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
  const isVerified = senderConfig?.isVerified || false;
  const companyName = senderConfig?.companyName || 'Your Garden Center';
  const { toast } = useToast();
  
  const [showDomainInput, setShowDomainInput] = useState(false);
  const [showDomainConnect, setShowDomainConnect] = useState(false);
  const [domain, setDomain] = useState('');
  const [isConfirmingQuickStart, setIsConfirmingQuickStart] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const handleDomainConnectComplete = () => {
    setShowDomainConnect(false);
    setShowDomainInput(false);
    onOpenChange(false);
    // Refresh sender configuration would happen here
  };

  const handleStartDomainSetup = () => {
    if (!domain.trim()) return;
    setShowDomainInput(false);
    setShowDomainConnect(true);
  };

  const handleBackToOptions = () => {
    setShowDomainConnect(false);
    setShowDomainInput(false);
    setDomain('');
  };

  const handleQuickStartConfirm = async () => {
    setIsConfirmingQuickStart(true);
    
    // Show celebration effect
    setShowCelebration(true);
    
    // Show success toast
    toast({
      title: "Quick Start Confirmed! ✅",
      description: "Your campaigns are ready to send immediately using our shared domain.",
    });
    
    // Wait for celebration to complete, then close modal
    setTimeout(() => {
      setIsConfirmingQuickStart(false);
      onOpenChange(false);
    }, 1500);
  };

  return (
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
          {/* Domain Connect Wizard View */}
          {showDomainConnect && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToOptions}
                  className="p-0 h-auto"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to options
                </Button>
              </div>
              <DomainConnectWizard
                domain={domain}
                templateId="email_auth"
                onComplete={handleDomainConnectComplete}
              />
            </>
          )}

          {/* Domain Input View */}
          {showDomainInput && !showDomainConnect && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToOptions}
                  className="p-0 h-auto"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to options
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Enter Your Domain</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    We'll automatically configure the DNS records for your domain
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain Name</Label>
                  <Input
                    id="domain"
                    type="text"
                    placeholder="yourdomain.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your domain without "www" (e.g., yourdomain.com)
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleStartDomainSetup}
                    className="flex-1"
                    disabled={!domain.trim()}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Start Automatic Setup
                  </Button>
                </div>
                
                <div className="text-center">
                  <Button 
                    variant="link" 
                    size="sm" 
                    asChild
                    className="text-xs"
                  >
                    <Link to="/crm/EmailDomainSetup" onClick={() => onOpenChange(false)}>
                      Skip to manual setup instead
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Default Options View */}
          {!showDomainInput && !showDomainConnect && (
            <>
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
                    ? `Emails sent from: ${senderConfig.senderEmail}`
                    : `Emails sent from: noreply@bloomsuite.email on behalf of ${companyName}`
                  }
                </p>
              </div>

              {/* Two Options */}
              <div className="grid gap-4">
                {/* Option 1: Quick Start (Shared Domain) */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold">Quick Start - Send Immediately</h3>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      Ready Now
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Send campaigns right away</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>No technical setup required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Uses our shared sending domain</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Emails will be sent from <code>noreply@bloomsuite.email</code> on behalf of {companyName}
                  </p>
                  {!isVerified && (
                    <Button 
                      onClick={handleQuickStartConfirm}
                      className="w-full"
                      variant="outline"
                      disabled={isConfirmingQuickStart}
                    >
                      {isConfirmingQuickStart ? 'Confirming...' : 'Continue with Quick Start'}
                    </Button>
                  )}
                </div>

                {/* Option 2: Custom Domain */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-brand-steel-blue-600" />
                    <h3 className="font-semibold">Professional Setup - Custom Domain</h3>
                    <Badge variant="outline" className="text-brand-steel-blue-600 border-brand-steel-blue-200">
                      Better Results
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-steel-blue-600" />
                      <span>Higher email deliverability</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-steel-blue-600" />
                      <span>Professional branding with your domain</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-brand-steel-blue-600" />
                      <span>Better spam folder protection</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatic setup (2-3 minutes) • Emails sent from your own domain
                  </p>
                  <Button 
                    onClick={() => setShowDomainInput(true)}
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {isVerified ? 'Manage Domain Setup' : 'Set Up Custom Domain'}
                  </Button>
                </div>
              </div>

              {/* Why This Matters */}
              <div className="bg-brand-steel-blue-50 border border-brand-steel-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-brand-steel-blue-800 mb-2">💡 Why does this matter?</h4>
                <div className="text-sm text-brand-steel-blue-700 space-y-1">
                  <p>• <strong>Deliverability:</strong> Custom domains have better inbox placement rates</p>
                  <p>• <strong>Trust:</strong> Recipients see emails from your business domain</p>
                  <p>• <strong>Branding:</strong> Consistent professional appearance across all communications</p>
                  <p>• <strong>Control:</strong> Full ownership of your email reputation</p>
                </div>
              </div>

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  You can always upgrade to custom domain setup later from Settings
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
      
      {/* Celebration Effect */}
      <CelebrationEffect 
        isVisible={showCelebration}
        onComplete={() => setShowCelebration(false)}
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
      />
    </Dialog>
  );
};