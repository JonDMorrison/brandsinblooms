import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ResetAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isResetting: boolean;
}

export const ResetAccountDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isResetting
}: ResetAccountDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Reset Master Admin Account
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            <strong>This will completely reset your Master Admin account for testing:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Delete all campaigns and content tasks</li>
              <li>• Clear company profile information</li>
              <li>• Reset tokens to 100</li>
              <li>• Remove social media connections</li>
              <li>• Clear all generated content</li>
              <li>• Trigger re-onboarding process</li>
            </ul>
            <p className="mt-3 text-sm font-medium text-orange-600">
              This action cannot be undone. Only use this for testing purposes.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isResetting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isResetting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isResetting ? "Resetting..." : "Reset Account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};