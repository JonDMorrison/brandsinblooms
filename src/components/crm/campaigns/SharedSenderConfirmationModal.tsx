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
import { AlertTriangle, Mail, Settings, X } from 'lucide-react';
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
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] flex flex-col">
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 pr-8">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span>Confirm Shared Sender</span>
          </DialogTitle>
          <DialogDescription>
            You're about to send "{campaignName}" to {recipientCount} recipients using our shared sender address.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto min-h-0 py-2">
          <Alert className="border-orange-200 bg-orange-50">
            <Mail className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-orange-800 text-sm">
                  Sending from: {senderConfig.displayName}
                </p>
                <p className="text-xs text-orange-700">
                  Email: <code className="break-all text-xs">{senderConfig.senderEmail}</code>
                </p>
                <p className="text-xs text-orange-600">
                  Recipients will see this as coming from BloomSuite on behalf of your business.
                </p>
              </div>
            </AlertDescription>
          </Alert>

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
          <Button asChild variant="ghost" size="sm" className="w-full text-xs h-8">
            <Link to="/crm/settings/email-auth" onClick={onClose}>
              <Settings className="h-3 w-3 mr-1" />
              Set up custom domain instead
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};