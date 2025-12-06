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
import { format } from 'date-fns';

interface DraftRestorationDialogProps {
  open: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  draftTimestamp?: string;
  dbTimestamp?: string;
}

export const DraftRestorationDialog: React.FC<DraftRestorationDialogProps> = ({
  open,
  onRestore,
  onDiscard,
  draftTimestamp,
  dbTimestamp
}) => {
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Unknown time';
    try {
      return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
    } catch {
      return 'Unknown time';
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore Unsaved Changes?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                We found unsaved changes from your previous session. Do you want to restore them?
              </p>
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                <p><strong>Draft saved:</strong> {formatTimestamp(draftTimestamp)}</p>
                {dbTimestamp && (
                  <p><strong>Last database save:</strong> {formatTimestamp(dbTimestamp)}</p>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>
            Discard Draft
          </AlertDialogCancel>
          <AlertDialogAction onClick={onRestore}>
            Restore Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
