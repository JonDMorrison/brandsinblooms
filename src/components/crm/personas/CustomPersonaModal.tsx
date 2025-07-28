import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';

interface CustomPersonaModalProps {
  open: boolean;
  onSave: (personaData: { name: string; description?: string }) => Promise<boolean>;
  onCancel: () => void;
}

export const CustomPersonaModal: React.FC<CustomPersonaModalProps> = ({
  open,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isMobile = useIsMobile();

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    const success = await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    if (success) {
      setName('');
      setDescription('');
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className={`${isMobile ? 'mobile-dialog-content' : 'sm:max-w-[425px]'} mobile-dialog-padding`}>
        <DialogHeader>
          <DialogTitle className={isMobile ? 'mobile-text-heading' : ''}>
            Create Custom Persona
          </DialogTitle>
        </DialogHeader>
        
        <div className={`${isMobile ? 'mobile-space-normal' : 'space-y-4'} mt-4`}>
          <div className="space-y-2">
            <Label htmlFor="persona-name" className={isMobile ? 'mobile-text-body' : ''}>
              Persona Name *
            </Label>
            <Input
              id="persona-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tech Enthusiast, Budget Shopper"
              className={`${isMobile ? 'mobile-touch-target' : ''} mobile-focus-ring`}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="persona-description" className={isMobile ? 'mobile-text-body' : ''}>
              Description
            </Label>
            <Textarea
              id="persona-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the characteristics, behaviors, and preferences of this persona..."
              rows={4}
              className={`${isMobile ? 'mobile-touch-target' : ''} mobile-focus-ring`}
            />
          </div>
        </div>
        
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-end gap-2'} mt-6`}>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className={`${isMobile ? 'mobile-btn-secondary mobile-touch-feedback w-full' : ''} mobile-focus-ring`}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className={`${isMobile ? 'mobile-btn-primary mobile-touch-feedback w-full' : ''} mobile-focus-ring`}
          >
            {isSaving ? 'Creating...' : 'Create Persona'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};