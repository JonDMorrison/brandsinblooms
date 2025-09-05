import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ContentBlock } from '@/types/emailBuilder';
import { X } from 'lucide-react';

interface AddBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBlock: (type: ContentBlock['type']) => void;
}

export const AddBlockModal: React.FC<AddBlockModalProps> = ({
  isOpen,
  onClose,
  onAddBlock
}) => {
  const blockTypes = [
    { 
      type: 'header' as const, 
      label: 'Header', 
      icon: '📄',
      description: 'Title and hero section'
    },
    { 
      type: 'text' as const, 
      label: 'Text', 
      icon: '📝',
      description: 'Paragraph content'
    },
    { 
      type: 'image' as const, 
      label: 'Image', 
      icon: '🖼️',
      description: 'Photos and graphics'
    },
    { 
      type: 'button' as const, 
      label: 'Button', 
      icon: '🔘',
      description: 'Call-to-action'
    },
    { 
      type: 'product' as const, 
      label: 'Product', 
      icon: '📦',
      description: 'Product showcase'
    },
    { 
      type: 'divider' as const, 
      label: 'Divider', 
      icon: '➖',
      description: 'Section separator'
    }
  ];

  const handleAddBlock = (type: ContentBlock['type']) => {
    onAddBlock(type);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="pr-8">Add Content Block</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {blockTypes.map(({ type, label, icon, description }) => (
            <Button
              key={type}
              variant="outline"
              onClick={() => handleAddBlock(type)}
              className="h-auto p-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/20"
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {description}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};