import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AIPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AIPersonalizationDialog: React.FC<AIPersonalizationDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI Personalization</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {/* Content will be added in future steps */}
        </div>
      </DialogContent>
    </Dialog>
  );
};
