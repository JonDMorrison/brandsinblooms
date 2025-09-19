import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Shield, Zap, Settings, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Sending Options
          </DialogTitle>
          <DialogDescription>
            Choose how you want to send your email campaigns
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                  variant="outline"
                >
                  Continue with Quick Start
                </Button>
              )}
            </div>

            {/* Option 2: Custom Domain */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Professional Setup - Custom Domain</h3>
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  Better Results
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span>Higher email deliverability</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span>Professional branding with your domain</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span>Better spam folder protection</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires DNS setup (5-10 minutes) • Emails sent from your own domain
              </p>
              <Button asChild className="w-full">
                <Link to="/crm/EmailDomainSetup" onClick={() => onOpenChange(false)}>
                  <Settings className="h-4 w-4 mr-2" />
                  {isVerified ? 'Manage Domain Setup' : 'Set Up Custom Domain'}
                </Link>
              </Button>
            </div>
          </div>

          {/* Why This Matters */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">💡 Why does this matter?</h4>
            <div className="text-sm text-blue-700 space-y-1">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};