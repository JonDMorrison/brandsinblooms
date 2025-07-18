import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EmailBlock } from '@/types/emailBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

interface SaveTemplateModalProps {
  open: boolean;
  onClose: () => void;
  blocks: EmailBlock[];
  onTemplateSaved?: () => void;
}

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  open,
  onClose,
  blocks,
  onTemplateSaved
}) => {
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (blocks.length === 0) {
      toast.error('Cannot save an empty template');
      return;
    }

    setSaving(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save templates');
        return;
      }

      const { error } = await supabase
        .from('saved_campaign_templates')
        .insert({
          name: templateName.trim(),
          description: description.trim() || null,
          layout_json: blocks as any,
          category: 'email',
          user_id: user.id
        });

      if (error) throw error;

      toast.success('Template saved successfully!');
      setTemplateName('');
      setDescription('');
      onTemplateSaved?.();
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setTemplateName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save as Template
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Spring Newsletter Layout"
              className="mt-1"
              disabled={saving}
            />
          </div>
          
          <div>
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when to use this template..."
              className="mt-1 resize-none"
              rows={3}
              disabled={saving}
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            This template will include {blocks.length} block{blocks.length !== 1 ? 's' : ''} and can be reused in future campaigns.
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};