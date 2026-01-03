import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Mail, Settings, X, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SenderConfig } from '@/hooks/useSenderConfiguration';

interface SharedSenderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  senderConfig: SenderConfig | null;
  campaignName: string;
  recipientCount: number;
}

export const SharedSenderConfirmationModal: React.FC<SharedSenderConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  senderConfig,
  campaignName,
  recipientCount
}) => {
  // Guard against null senderConfig - don't render if not loaded
  if (!senderConfig) {
    return null;
  }

  const isPlatformEmail = senderConfig.deliveryMethod === 'platform';
  const isSharedSender = senderConfig.deliveryMethod === 'shared';

  // Different styling based on delivery method
  const alertConfig = isPlatformEmail ? {
    borderClass: 'border-blue-200 bg-blue-50',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-800',
    textColor: 'text-blue-700',
    mutedColor: 'text-blue-600',
    codeClass: 'bg-blue-100'
  } : {
    borderClass: 'border-orange-200 bg-orange-50',
    iconColor: 'text-orange-600',
    titleColor: 'text-orange-800',
    textColor: 'text-orange-700',
    mutedColor: 'text-orange-600',
    codeClass: 'bg-orange-100'
  };

  const getDescription = () => {
    if (isPlatformEmail) {
      return `Your BloomSuite platform email address will be used to send this campaign.`;
    }
    return `Recipients will see this as coming from BloomSuite on behalf of your business.`;
  };

  const getDialogTitle = () => {
    if (isPlatformEmail) {
      return 'Confirm Platform Email';
    }
    return 'Confirm Shared Sender';
  };

  const getIcon = () => {
    if (isPlatformEmail) {
      return <Mail className="h-5 w-5 text-blue-600" />;
    }
    return <AlertTriangle className="h-5 w-5 text-orange-600" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] flex flex-col">
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 pr-8">
            {getIcon()}
            <span>{getDialogTitle()}</span>
          </DialogTitle>
          <DialogDescription>
            You're about to send "{campaignName}" to {recipientCount} recipients.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto min-h-0 py-2">
          <Alert className={alertConfig.borderClass}>
            <Mail className={`h-4 w-4 ${alertConfig.iconColor}`} />
            <AlertDescription>
              <div className="space-y-2">
                <p className={`font-medium ${alertConfig.titleColor} text-sm`}>
                  Sending from: {senderConfig.displayName}
                </p>
                <p className={`text-xs ${alertConfig.textColor}`}>
                  Email: <code className={`break-all text-xs ${alertConfig.codeClass} px-1 rounded`}>{senderConfig.senderEmail}</code>
                </p>
                <p className={`text-xs ${alertConfig.mutedColor}`}>
                  {getDescription()}
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {isPlatformEmail && (
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-800 text-sm">Platform email ready</h4>
                  <p className="text-xs text-green-700 mt-1">
                    Your dedicated BloomSuite email address is set up and ready to send. 
                    For even better branding, you can verify your custom domain.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isSharedSender && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2 text-sm">💡 Want better results?</h4>
              <p className="text-xs text-blue-700 mb-2">
                Verify your custom domain to:
              </p>
              <ul className="text-xs text-blue-600 space-y-0.5 ml-3">
                <li>• Improve email deliverability</li>
                <li>• Build stronger brand trust</li>
                <li>• Reduce spam folder placement</li>
                <li>• Use your own business email address</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col space-y-1.5 pt-3">
          <div className="flex space-x-2 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1 text-sm">
              Cancel
            </Button>
            <Button onClick={onConfirm} className="flex-1 text-sm">
              Send Campaign
            </Button>
          </div>
          {!senderConfig.isVerified && (
            <Button asChild variant="ghost" size="sm" className="w-full text-xs h-8">
              <Link to="/crm/settings/email-auth" onClick={onClose}>
                <Settings className="h-3 w-3 mr-1" />
                Set up custom domain instead
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
