import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Mail, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SenderConfig } from '@/hooks/useSenderConfiguration';

interface SharedSenderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  senderConfig: SenderConfig;
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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[92vw] sm:w-full max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span>Confirm Shared Sender</span>
          </DialogTitle>
          <DialogDescription>
            You're about to send "{campaignName}" to {recipientCount} recipients using our shared sender address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 w-full overflow-y-auto">
          <Alert className="border-orange-200 bg-orange-50 w-full">
            <Mail className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-orange-800">
                  Sending from: {senderConfig.displayName}
                </p>
                <p className="text-sm text-orange-700">
                  Email address: <code className="break-words">{senderConfig.senderEmail}</code>
                </p>
                <p className="text-sm text-orange-600">
                  Recipients will see this email as coming from BloomSuite on behalf of your business.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg w-full">
            <h4 className="font-medium text-blue-800 mb-2">💡 Want better results?</h4>
            <p className="text-sm text-blue-700 mb-3">
              Verify your custom domain to:
            </p>
            <ul className="text-sm text-blue-600 space-y-1 ml-4">
              <li>• Improve email deliverability</li>
              <li>• Build stronger brand trust</li>
              <li>• Reduce spam folder placement</li>
              <li>• Use your own business email address</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col space-y-2">
          <div className="flex space-x-2 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={onConfirm} className="flex-1">
              Send Campaign
            </Button>
          </div>
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/crm/settings/email-auth" onClick={onClose}>
              <Settings className="h-4 w-4 mr-2" />
              Set up custom domain instead
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};