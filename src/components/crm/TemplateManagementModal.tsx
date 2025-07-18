import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EmailBlock } from '@/types/emailBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Edit3, Trash2, Copy, AlertTriangle } from 'lucide-react';

interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  layout_json: EmailBlock[];
  thumbnail_url?: string;
  usage_count: number;
  tags: string[];
  created_at: string;
}

interface TemplateManagementModalProps {
  open: boolean;
  onClose: () => void;
  template: SavedTemplate | null;
  onTemplateUpdated: () => void;
  action: 'rename' | 'duplicate' | 'delete';
}

export const TemplateManagementModal: React.FC<TemplateManagementModalProps> = ({
  open,
  onClose,
  template,
  onTemplateUpdated,
  action
}) => {
  const [templateName, setTemplateName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (template) {
      setTemplateName(template.name);
      setDescription(template.description || '');
    }
  }, [template]);

  const handleRename = async () => {
    if (!template || !templateName.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('saved_campaign_templates')
        .update({
          name: templateName.trim(),
          description: description.trim() || null
        })
        .eq('id', template.id);

      if (error) throw error;

      toast.success('Template updated successfully!');
      onTemplateUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!template || !templateName.trim()) return;

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to duplicate templates');
        return;
      }

      const { error } = await supabase
        .from('saved_campaign_templates')
        .insert({
          name: templateName.trim(),
          description: description.trim() || null,
          layout_json: template.layout_json as any,
          category: 'email',
          tags: template.tags,
          user_id: user.id
        });

      if (error) throw error;

      toast.success('Template duplicated successfully!');
      onTemplateUpdated();
      onClose();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('saved_campaign_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast.success('Template deleted successfully!');
      onTemplateUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const getActionConfig = () => {
    switch (action) {
      case 'rename':
        return {
          title: 'Rename Template',
          icon: Edit3,
          buttonText: 'Update Template',
          buttonAction: handleRename,
          showForm: true
        };
      case 'duplicate':
        return {
          title: 'Duplicate Template',
          icon: Copy,
          buttonText: 'Create Duplicate',
          buttonAction: handleDuplicate,
          showForm: true
        };
      case 'delete':
        return {
          title: 'Delete Template',
          icon: AlertTriangle,
          buttonText: 'Delete Template',
          buttonAction: handleDelete,
          showForm: false,
          destructive: true
        };
      default:
        return null;
    }
  };

  const config = getActionConfig();
  if (!config || !template) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <config.icon className="w-5 h-5" />
            {config.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {action === 'delete' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">This action cannot be undone</p>
                  <p className="text-sm text-muted-foreground">
                    Template "{template.name}" will be permanently deleted.
                  </p>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                • Template has been used {template.usage_count} time{template.usage_count !== 1 ? 's' : ''}
                <br />
                • Contains {template.layout_json.length} block{template.layout_json.length !== 1 ? 's' : ''}
                <br />
                • Created {new Date(template.created_at).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                  className="mt-1"
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
              
              {action === 'duplicate' && (
                <div className="text-sm text-muted-foreground">
                  This will create a copy of the template with {template.layout_json.length} block{template.layout_json.length !== 1 ? 's' : ''}.
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={config.buttonAction}
            disabled={loading || (config.showForm && !templateName.trim())}
            variant={config.destructive ? 'destructive' : 'default'}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {action === 'delete' ? 'Deleting...' : 'Saving...'}
              </>
            ) : (
              <>
                <config.icon className="w-4 h-4 mr-2" />
                {config.buttonText}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};