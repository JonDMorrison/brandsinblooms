import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmailBlock } from '@/types/emailBuilder';
import { Loader2, Save, Plus, X } from 'lucide-react';

interface SaveBlockModalProps {
  open: boolean;
  onClose: () => void;
  block: EmailBlock;
  onBlockSaved?: () => void;
}

export const SaveBlockModal: React.FC<SaveBlockModalProps> = ({
  open,
  onClose,
  block,
  onBlockSaved
}) => {
  const [blockName, setBlockName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!blockName.trim()) {
      toast.error('Please enter a block name');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save blocks');
        return;
      }

      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('saved_blocks')
        .insert({
          name: blockName.trim(),
          content: block.content,
          block_type: block.block_type,
          tags: tags,
          user_id: user.id,
          tenant_id: userData?.tenant_id || null,
          is_bloomsuite_block: false
        });

      if (error) throw error;

      toast.success('Block saved successfully!');
      setBlockName('');
      setTags([]);
      setNewTag('');
      onBlockSaved?.();
      onClose();
    } catch (error) {
      console.error('Error saving block:', error);
      toast.error('Failed to save block');
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleClose = () => {
    if (!saving) {
      setBlockName('');
      setTags([]);
      setNewTag('');
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Block to Library
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="block-name">Block Name *</Label>
            <Input
              id="block-name"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              placeholder="e.g., Spring Promotion Header"
              className="mt-1"
              disabled={saving}
            />
          </div>
          
          <div>
            <Label>Tags (optional)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a tag..."
                className="flex-1"
                disabled={saving}
              />
              <Button
                type="button"
                size="sm"
                onClick={addTag}
                disabled={!newTag.trim() || saving}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-2">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      disabled={saving}
                      className="hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-sm text-muted-foreground">
            This {block.block_type} block will be saved to your library and can be reused in future campaigns.
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
                Save Block
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};