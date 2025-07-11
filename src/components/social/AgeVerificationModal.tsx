import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AgeVerificationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDeny: () => void;
  onClose: () => void;
}

export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({
  isOpen,
  onConfirm,
  onDeny,
  onClose,
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-md !bg-white text-gray-900 border border-gray-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center text-gray-900">Age Verification</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base text-gray-700">
            Are you 13 years old or older?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel 
            onClick={onDeny}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            No, I'm under 13
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            Yes, I am 13+
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};