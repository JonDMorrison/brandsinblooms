import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmailBlock, BlockType } from '@/types/emailBuilder';
import { bloomsuiteDefaultBlocks, BloomSuiteBlock } from './BloomSuiteDefaultBlocks';
import {
  Search,
  Plus,
  Clock,
  Star,
  Bookmark,
  Sparkles,
  FileText,
  Image,
  MousePointer,
  Package,
  Minus,
  Type
} from 'lucide-react';

interface SavedBlock {
  id: string;
  name: string;
  content: any;
  block_type: BlockType;
  tags: string[];
  usage_count: number;
  is_bloomsuite_block: boolean;
  created_at: string;
}

interface SavedBlockLibraryDrawerProps {
  open: boolean;
  onClose: () => void;
  onInsertBlock: (block: EmailBlock) => void;
  recentBlocks?: EmailBlock[];
}

export const SavedBlockLibraryDrawer: React.FC<SavedBlockLibraryDrawerProps> = ({
  open,
  onClose,
  onInsertBlock,
  recentBlocks = []
}) => {
  const [savedBlocks, setSavedBlocks] = useState<SavedBlock[]>([]);
  const [bloomsuiteBlocks, setBloomsuiteBlocks] = useState<SavedBlock[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadBlocks();
    }
  }, [open]);

  const loadBlocks = async () => {
    setLoading(true);
    try {
      // Load user-saved blocks from database
      const { data, error } = await supabase
        .from('saved_blocks')
        .select('*')
        .eq('is_bloomsuite_block', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const userBlocks = (data || []).map(block => ({
        ...block,
        block_type: block.block_type as BlockType
      }));

      setSavedBlocks(userBlocks);
      
      // Set static BloomSuite blocks
      setBloomsuiteBlocks(bloomsuiteDefaultBlocks);
    } catch (error) {
      console.error('Error loading blocks:', error);
      toast.error('Failed to load saved blocks');
    } finally {
      setLoading(false);
    }
  };

  const handleInsertBlock = async (savedBlock: SavedBlock) => {
    try {
      // Create a new block with a fresh ID
      const newBlock: EmailBlock = {
        id: crypto.randomUUID(),
        block_type: savedBlock.block_type,
        content: savedBlock.content,
        order_index: 0, // Will be set by parent component
        campaign_id: '', // Will be set by parent component
        source: 'library'
      };

      // Only update usage count for user-saved blocks (not BloomSuite defaults)
      if (!savedBlock.is_bloomsuite_block) {
        await supabase
          .from('saved_blocks')
          .update({ usage_count: savedBlock.usage_count + 1 })
          .eq('id', savedBlock.id);
      }

      onInsertBlock(newBlock);
      toast.success(`Inserted "${savedBlock.name}" block`);
    } catch (error) {
      console.error('Error inserting block:', error);
      toast.error('Failed to insert block');
    }
  };

  const saveBloomsuiteBlock = async (block: SavedBlock) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('saved_blocks')
        .insert({
          name: `${block.name} (My Copy)`,
          content: block.content,
          block_type: block.block_type,
          tags: block.tags,
          user_id: user.id,
          is_bloomsuite_block: false
        });

      if (error) throw error;
      
      toast.success('Block saved to your library');
      loadBlocks();
    } catch (error) {
      console.error('Error saving block:', error);
      toast.error('Failed to save block');
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

  const filteredBlocks = (blocks: SavedBlock[]) => {
    return blocks.filter(block => {
      const matchesSearch = !searchQuery || 
        block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        block.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesTags = selectedTags.length === 0 ||
        selectedTags.some(tag => block.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  };

  const allTags = [...new Set([
    ...savedBlocks.flatMap(block => block.tags),
    ...bloomsuiteBlocks.flatMap(block => block.tags)
  ])];

  const BlockCard = ({ block, showSaveOption = false }: { block: SavedBlock; showSaveOption?: boolean }) => {
    const IconComponent = getBlockIcon(block.block_type);
    
    return (
      <Card className="group hover:shadow-md transition-all duration-200">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Block preview */}
            <div className="h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
              <IconComponent className="h-8 w-8 text-gray-400" />
            </div>

            {/* Block info */}
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-1">{block.name}</h4>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Badge variant="outline" className="text-xs">
                  {block.block_type}
                </Badge>
                {block.usage_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {block.usage_count}
                  </span>
                )}
              </div>
            </div>

            {/* Tags */}
            {block.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {block.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {block.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{block.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleInsertBlock(block)}
                className="flex-1 gap-2"
              >
                <Plus className="h-4 w-4" />
                Insert
              </Button>
              {showSaveOption && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveBloomsuiteBlock(block)}
                  className="gap-2"
                >
                  <Bookmark className="h-4 w-4" />
                  Save
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-96 sm:w-[480px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            📚 Block Library
          </SheetTitle>
        </SheetHeader>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search blocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allTags.slice(0, 8).map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
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

        {/* Block Tabs */}
        <Tabs defaultValue="bloomsuite" className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bloomsuite" className="gap-2 text-xs">
              <Sparkles className="h-4 w-4" />
              BloomSuite
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2 text-xs">
              <Bookmark className="h-4 w-4" />
              Saved
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-2 text-xs">
              <Clock className="h-4 w-4" />
              Recent
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 h-[calc(100vh-280px)] overflow-y-auto">
            <TabsContent value="bloomsuite" className="mt-0">
              {loading ? (
                <div className="grid grid-cols-1 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-32 bg-gray-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredBlocks(bloomsuiteBlocks).length > 0 ? (
                    filteredBlocks(bloomsuiteBlocks).map(block => (
                      <BlockCard key={block.id} block={block} showSaveOption={true} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No BloomSuite blocks available</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved" className="mt-0">
              <div className="grid grid-cols-1 gap-4">
                {filteredBlocks(savedBlocks).length > 0 ? (
                  filteredBlocks(savedBlocks).map(block => (
                    <BlockCard key={block.id} block={block} />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">No saved blocks yet</p>
                    <p className="text-sm">Save blocks from your campaigns to reuse them later</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="recent" className="mt-0">
              <div className="grid grid-cols-1 gap-4">
                {recentBlocks.length > 0 ? (
                  recentBlocks.slice(0, 3).map((block, index) => (
                    <Card key={`recent-${index}`} className="group hover:shadow-md transition-all duration-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                            <Clock className="h-8 w-8 text-blue-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm text-gray-900 mb-1">
                              {block.block_type.charAt(0).toUpperCase() + block.block_type.slice(1)} Block
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {block.block_type}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => onInsertBlock(block)}
                            className="w-full gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Insert Again
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recently used blocks</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};