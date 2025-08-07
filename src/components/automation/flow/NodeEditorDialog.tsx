import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmailNodeEditor } from './editors/EmailNodeEditor';
import { SMSNodeEditor } from './editors/SMSNodeEditor';
import { DelayNodeEditor } from './editors/DelayNodeEditor';
import { TriggerNodeEditor } from './editors/TriggerNodeEditor';
import { SplitNodeEditor } from './editors/SplitNodeEditor';

interface NodeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeType: string | null;
  nodeData: any;
  onSave: (data: any) => void;
}

export const NodeEditorDialog: React.FC<NodeEditorDialogProps> = ({
  open,
  onOpenChange,
  nodeType,
  nodeData,
  onSave
}) => {
  const handleSave = (data: any) => {
    onSave(data);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const renderEditor = () => {
    if (!nodeType || !nodeData) return null;

    switch (nodeType) {
      case 'email':
        return (
          <EmailNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case 'sms':
        return (
          <SMSNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case 'delay':
        return (
          <DelayNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case 'trigger':
        return (
          <TriggerNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case 'split':
        return (
          <SplitNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-none w-auto bg-transparent border-none shadow-none">
        {renderEditor()}
      </DialogContent>
    </Dialog>
  );
};