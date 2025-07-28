import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CustomSegmentBuilder } from '@/components/crm/CustomSegmentBuilder';

interface CustomSegmentModalProps {
  open: boolean;
  onSave: (segmentData: { name: string; filters: any[] }) => void;
  onCancel: () => void;
}

export const CustomSegmentModal: React.FC<CustomSegmentModalProps> = ({
  open,
  onSave,
  onCancel
}) => {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Segment</DialogTitle>
        </DialogHeader>
        <CustomSegmentBuilder onSave={onSave} onCancel={onCancel} />
      </DialogContent>
    </Dialog>
  );
};