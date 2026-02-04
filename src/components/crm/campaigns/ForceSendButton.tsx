import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Zap, ShieldAlert, Loader2 } from 'lucide-react';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useForceSendCampaign } from '@/hooks/crm/useForceSendCampaign';

interface ForceSendButtonProps {
  campaignId: string;
  campaignName: string;
  status: string;
  failureReason?: string | null;
  onSuccess?: () => void;
  size?: 'sm' | 'default' | 'lg';
}

export function ForceSendButton({
  campaignId,
  campaignName,
  status,
  failureReason,
  onSuccess,
  size = 'sm'
}: ForceSendButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { data: isSuperAdmin, isLoading: isAdminLoading } = useIsSuperAdmin();
  const { forceSend, isLoading } = useForceSendCampaign();

  // Only show for admins and valid statuses
  const allowedStatuses = ['scheduled', 'failed'];
  const canForceSend = isSuperAdmin && allowedStatuses.includes(status);

  if (isAdminLoading || !canForceSend) {
    return null;
  }

  const handleForceSend = async () => {
    setShowConfirmDialog(false);
    const result = await forceSend(campaignId);
    if (result.success) {
      onSuccess?.();
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        size={size}
        onClick={() => setShowConfirmDialog(true)}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        Force Send
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Force Send Campaign
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to force send the campaign <strong>"{campaignName}"</strong>.
                </p>
                
                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                  <div><strong>Current Status:</strong> {status}</div>
                  {failureReason && (
                    <div><strong>Previous Error:</strong> {failureReason}</div>
                  )}
                </div>

                <p className="text-destructive font-medium">
                  This action will:
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Reset the failure reason</li>
                  <li>Queue the campaign for immediate sending</li>
                  <li>Log this admin override action</li>
                </ul>
                
                <p className="text-sm text-muted-foreground">
                  This action is logged and cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceSend}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Zap className="h-4 w-4 mr-2" />
              Force Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
