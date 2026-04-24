import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui-legacy/dialog';
import { Button } from '@/components/ui-legacy/button';
import { ContentBlock } from '@/types/emailBuilder';
import { X, Minus } from 'lucide-react';

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
    // NEW: Email-safe hero blocks at the top (recommended)
    { 
      type: 'email-safe-hero' as const, 
      label: 'Hero (Email Safe)', 
      icon: '⭐',
      description: 'Recommended – text on solid, image below',
      recommended: true
    },
    { 
      type: 'graphic-hero' as const, 
      label: 'Graphic Hero', 
      icon: '🖼️',
      description: 'Image only – text baked into graphic'
    },
    // Structure
    {
      type: 'divider' as const,
      label: 'Divider',
      icon: 'divider-line',
      description: 'Styled horizontal line to separate content sections'
    },
    {
      type: 'button' as const,
      label: 'Button',
      icon: '🔘',
      description: 'Call-to-action'
    },
    // Content blocks
    {
      type: 'image-text' as const,
      label: 'Content with Image',
      icon: '📝',
      description: 'Text content with image'
    },
    {
      type: 'image' as const,
      label: 'Image',
      icon: '🖼️',
      description: 'Photos and graphics'
    },
    {
      type: 'image-gallery' as const,
      label: 'Image Gallery',
      icon: '🖼️🖼️🖼️',
      description: 'Grid of 3, 6, or 9 images'
    },
    {
      type: 'image-gallery' as const,
      label: 'Product Gallery',
      icon: '🪴',
      description: '2×2 product grid with badges'
    },
    {
      type: 'product' as const,
      label: 'Product',
      icon: '📦',
      description: 'Product showcase'
    },
    // Legacy overlay header - kept for backwards compatibility
    { 
      type: 'header' as const, 
      label: 'Overlay Header', 
      icon: '📄',
      description: 'Legacy – not recommended for email dark mode',
      legacy: true
    },
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
          {blockTypes.map(({ type, label, icon, description, recommended, legacy }) => (
            <Button
              key={`${type}-${label}`}
              variant="outline"
              onClick={() => handleAddBlock(type)}
              className={`h-auto p-4 flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/20 relative ${
                recommended ? 'border-emerald-500/50 bg-emerald-500/5' : ''
              } ${legacy ? 'opacity-60' : ''}`}
            >
              {recommended && (
                <span className="absolute -top-2 -right-2 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                  Recommended
                </span>
              )}
              {icon === 'divider-line' ? (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-muted-foreground">
                  <line x1="4" y1="16" x2="28" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <span className="text-2xl">{icon}</span>
              )}
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {description}
              </span>
              {legacy && (
                <span className="text-[10px] text-amber-600 mt-1">⚠️ Dark mode issues</span>
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};