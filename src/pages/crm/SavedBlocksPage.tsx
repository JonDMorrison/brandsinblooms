import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BlockType } from '@/types/emailBuilder';
import {
  Search,
  Star,
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  ArrowLeft,
  FileText,
  Image,
  MousePointer,
  Type,
  Minus,
  Package
} from 'lucide-react';

interface SavedBlock {
  id: string;
  name: string;
  content: any;
  block_type: BlockType;
  tags: string[];
  usage_count: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export const SavedBlocksPage: React.FC = () => {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<SavedBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [blockToRename, setBlockToRename] = useState<SavedBlock | null>(null);
  const [newBlockName, setNewBlockName] = useState('');

  useEffect(() => {
    loadBlocks();
  }, []);

  const loadBlocks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_blocks' as any)
        .select('*')
        .eq('is_bloomsuite_block', false)
        .order('is_favorite', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setBlocks(((data as unknown) as SavedBlock[]) || []);
    } catch (error) {
      console.error('Error loading blocks:', error);
      toast.error('Failed to load saved blocks');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (block: SavedBlock) => {
    try {
      const { error } = await supabase
        .from('saved_blocks' as any)
        .update({ is_favorite: !block.is_favorite })
        .eq('id', block.id);

      if (error) throw error;

      setBlocks(blocks.map(b =>
        b.id === block.id ? { ...b, is_favorite: !b.is_favorite } : b
      ));
      toast.success(block.is_favorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite status');
    }
  };

  const duplicateBlock = async (block: SavedBlock) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users' as any)
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('saved_blocks' as any)
        .insert({
          name: `${block.name} (Copy)`,
          content: block.content,
          block_type: block.block_type,
          tags: block.tags,
          user_id: user.id,
          tenant_id: (userData as any)?.tenant_id || null,
          is_bloomsuite_block: false,
          is_favorite: false
        });

      if (error) throw error;

      toast.success('Block duplicated successfully');
      loadBlocks();
    } catch (error) {
      console.error('Error duplicating block:', error);
      toast.error('Failed to duplicate block');
    }
  };

  const deleteBlock = async (blockId: string) => {
    if (!confirm('Are you sure you want to delete this block?')) return;

    try {
      const { error } = await supabase
        .from('saved_blocks' as any)
        .delete()
        .eq('id', blockId);

      if (error) throw error;

      setBlocks(blocks.filter(b => b.id !== blockId));
      toast.success('Block deleted successfully');
    } catch (error) {
      console.error('Error deleting block:', error);
      toast.error('Failed to delete block');
    }
  };

  const handleRename = async () => {
    if (!blockToRename || !newBlockName.trim()) return;

    try {
      const { error } = await supabase
        .from('saved_blocks' as any)
        .update({ name: newBlockName.trim() })
        .eq('id', blockToRename.id);

      if (error) throw error;

      setBlocks(blocks.map(b =>
        b.id === blockToRename.id ? { ...b, name: newBlockName.trim() } : b
      ));
      toast.success('Block renamed successfully');
      setRenameDialogOpen(false);
      setBlockToRename(null);
      setNewBlockName('');
    } catch (error) {
      console.error('Error renaming block:', error);
      toast.error('Failed to rename block');
    }
  };

  const getBlockIcon = (blockType: BlockType) => {
    const icons = {
      text: FileText,
      image: Image,
      button: MousePointer,
      header: Type,
      divider: Minus,
      product: Package
    };
    return icons[blockType] || FileText;
  };

  const filteredBlocks = blocks.filter(block => {
    const matchesSearch = !searchQuery ||
      block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTags = selectedTags.length === 0 ||
      selectedTags.some(tag => block.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  const allTags = [...new Set(blocks.flatMap(block => block.tags))];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/crm/campaigns')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Saved Blocks</h1>
            <p className="text-muted-foreground">
              Manage your reusable email content blocks
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}
        </Badge>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search blocks by name or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => {
                      setSelectedTags(prev =>
                        prev.includes(tag)
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blocks Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-muted rounded-lg mb-4"></div>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredBlocks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlocks.map(block => {
            const IconComponent = getBlockIcon(block.block_type);

            return (
              <Card
                key={block.id}
                className="group hover:shadow-lg transition-all duration-200"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">
                          {block.name}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs mt-1">
                          {block.block_type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={block.is_favorite ? 'text-yellow-500' : ''}
                        onClick={() => toggleFavorite(block)}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={block.is_favorite ? 'currentColor' : 'none'}
                        />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setBlockToRename(block);
                              setNewBlockName(block.name);
                              setRenameDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateBlock(block)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteBlock(block.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Preview */}
                  <div className="h-32 bg-gradient-to-br from-muted/50 to-muted rounded-lg flex items-center justify-center mb-4">
                    <IconComponent className="h-12 w-12 text-muted-foreground/50" />
                  </div>

                  {/* Tags */}
                  {block.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {block.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {block.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{block.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MousePointer className="h-3 w-3" />
                      Used {block.usage_count} times
                    </span>
                    <span className="text-xs">
                      {new Date(block.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No blocks found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedTags.length > 0
                ? 'Try adjusting your search or filters'
                : 'Save blocks from your email campaigns to reuse them later'}
            </p>
            <Button onClick={() => navigate('/crm/campaigns')}>
              Go to Campaigns
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Block</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="block-name">Block Name</Label>
              <Input
                id="block-name"
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
                placeholder="Enter new name..."
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newBlockName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
