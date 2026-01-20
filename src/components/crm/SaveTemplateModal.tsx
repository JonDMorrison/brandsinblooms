import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { EmailBlock } from '@/types/emailBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Zap } from 'lucide-react';
import { TemplateTagSelector } from './TemplateTagSelector';

interface SaveTemplateModalProps {
  open: boolean;
  onClose: () => void;
  blocks: EmailBlock[];
  onTemplateSaved?: () => void;
}

// Simple block-to-HTML renderer for preview thumbnail
const renderBlocksToPreviewHtml = (blocks: EmailBlock[]): string => {
  if (!blocks?.length) return '';
  return blocks.map(block => {
    const headline = (block as any).headline || (block as any).title || '';
    const body = (block as any).body || (block as any).content || '';
    const imageUrl = (block as any).imageUrl || '';
    switch (block.type) {
      case 'header':
      case 'newsletter-header':
        return `<div style="background:#1f2937;padding:20px;text-align:center;"><h1 style="color:#fff;font-size:18px;margin:0;">${headline}</h1></div>`;
      case 'text':
        return `<div style="padding:10px;"><p style="font-size:12px;margin:0;color:#374151;">${body.slice(0, 100)}${body.length > 100 ? '...' : ''}</p></div>`;
      case 'image':
        return imageUrl ? `<div style="padding:10px;"><img src="${imageUrl}" style="max-width:100%;height:auto;border-radius:4px;" /></div>` : '';
      default:
        return body ? `<div style="padding:10px;"><p style="font-size:12px;margin:0;">${body.slice(0, 80)}</p></div>` : '';
    }
  }).join('');
};

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  open,
  onClose,
  blocks,
  onTemplateSaved
}) => {
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [automationReady, setAutomationReady] = useState(false);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save templates');
        return;
      }

      // Generate lightweight preview HTML for thumbnails
      const renderedPreviewHtml = renderBlocksToPreviewHtml(blocks);

      const { error } = await supabase
        .from('saved_campaign_templates')
        .insert({
          name: templateName.trim(),
          description: description.trim() || null,
          layout_json: blocks as any,
          category: 'email',
          tags: selectedTags,
          user_id: user.id,
          automation_ready: automationReady,
          rendered_preview_html: renderedPreviewHtml
        });

      if (error) throw error;

      toast.success('Template saved successfully!');
      setTemplateName('');
      setDescription('');
      setSelectedTags([]);
      setAutomationReady(false);
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
      setSelectedTags([]);
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
          
          <TemplateTagSelector
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            disabled={saving}
          />
          
          {/* Automation Ready Checkbox */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="automation-ready"
              checked={automationReady}
              onCheckedChange={(checked) => setAutomationReady(checked === true)}
              disabled={saving}
            />
            <div className="flex-1">
              <Label htmlFor="automation-ready" className="flex items-center gap-2 cursor-pointer">
                <Zap className="h-4 w-4 text-amber-500" />
                Usable in automations
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Mark this template as ready for automated email sequences
              </p>
            </div>
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