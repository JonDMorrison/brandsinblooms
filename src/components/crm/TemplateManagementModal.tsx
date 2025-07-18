import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmailBlock } from '@/types/emailBuilder';
import { 
  Settings, Edit2, Copy, Trash2, MoreVertical, 
  Calendar, User, Sparkles, Search, Eye 
} from 'lucide-react';

interface SavedTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  category: string;
  tags: string[];
  layout_json: EmailBlock[];
  usage_count: number;
  created_at: string;
}

interface TemplateManagementModalProps {
  open: boolean;
  onClose: () => void;
  template?: SavedTemplate;
  onTemplateUpdated?: () => void;
  action?: 'rename' | 'duplicate' | 'delete';
}

export const TemplateManagementModal: React.FC<TemplateManagementModalProps> = ({
  open,
  onClose,
  template,
  onTemplateUpdated,
  action
}) => {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTemplates, setFilteredTemplates] = useState<SavedTemplate[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  useEffect(() => {
    const filtered = templates.filter(t => 
      !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    setFilteredTemplates(filtered);
  }, [templates, searchQuery]);

  useEffect(() => {
    if (action && template) {
      switch (action) {
        case 'rename':
          handleRenameAction(template);
          break;
        case 'duplicate':
          handleDuplicate(template);
          break;
        case 'delete':
          handleDeleteAction(template);
          break;
      }
    }
  }, [action, template]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('saved_campaign_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const processedTemplates: SavedTemplate[] = (data || []).map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || '',
        thumbnail_url: template.thumbnail_url || '',
        category: template.category || 'general',
        tags: template.tags || [],
        layout_json: (template.layout_json as any) || [],
        usage_count: template.usage_count || 0,
        created_at: template.created_at
      }));
      
      setTemplates(processedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameAction = (template: SavedTemplate) => {
    setSelectedTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description);
    setShowRenameDialog(true);
  };

  const handleDeleteAction = (template: SavedTemplate) => {
    setSelectedTemplate(template);
    setShowDeleteDialog(true);
  };

  const handleRename = async () => {
    if (!selectedTemplate || !editName.trim()) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('saved_campaign_templates')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null
        })
        .eq('id', selectedTemplate.id);

      if (error) throw error;
      
      toast.success('Template updated successfully');
      loadTemplates();
      onTemplateUpdated?.();
      setShowRenameDialog(false);
    } catch (error) {
      console.error('Error renaming template:', error);
      toast.error('Failed to update template');
    } finally {
      setProcessing(false);
    }
  };

  const handleDuplicate = async (template: SavedTemplate) => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('saved_campaign_templates')
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          layout_json: template.layout_json as any,
          category: template.category,
          tags: template.tags,
          user_id: user.id
        });

      if (error) throw error;
      
      toast.success('Template duplicated successfully');
      loadTemplates();
      onTemplateUpdated?.();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('saved_campaign_templates')
        .delete()
        .eq('id', selectedTemplate.id);

      if (error) throw error;
      
      toast.success('Template deleted successfully');
      loadTemplates();
      onTemplateUpdated?.();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    } finally {
      setProcessing(false);
    }
  };

  const TemplateCard: React.FC<{ template: SavedTemplate }> = ({ template }) => (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-sm truncate">{template.name}</h4>
              <Badge variant="outline" className="text-xs">
                {template.category}
              </Badge>
            </div>
            
            {template.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {template.description}
              </p>
            )}
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(template.created_at).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {template.usage_count} uses
              </div>
            </div>
            
            {template.tags && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {template.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{template.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleRenameAction(template)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteAction(template)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Manage Templates
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {/* Search */}
            <div className="p-6 pb-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search your templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Templates List */}
            <div className="p-6 overflow-y-auto max-h-96">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-24 bg-gray-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No templates found</p>
                  {searchQuery && (
                    <p className="text-sm">Try adjusting your search terms</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTemplates.map(template => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Template</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Template name"
                disabled={processing}
              />
            </div>
            <div>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                disabled={processing}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowRenameDialog(false)} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={processing || !editName.trim()}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={processing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={processing}>
              Delete Template
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};