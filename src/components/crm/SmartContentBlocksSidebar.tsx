import React, { useState, useMemo } from 'react';
import { Search, Plus, Bookmark, X, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { SmartBlock, SMART_BLOCK_CATEGORIES } from '@/types/smartBlocks';
import { SMART_BLOCK_TEMPLATES } from '@/data/smartBlockTemplates';
import { EmailBlock } from '@/types/emailBuilder';

interface SmartContentBlocksSidebarProps {
  open: boolean;
  onClose: () => void;
  onAddBlocks: (blocks: EmailBlock[]) => void;
  savedBlocks?: SmartBlock[];
  onSaveBlock?: (block: SmartBlock) => void;
  onDeleteSavedBlock?: (blockId: string) => void;
}

export const SmartContentBlocksSidebar: React.FC<SmartContentBlocksSidebarProps> = ({
  open,
  onClose,
  onAddBlocks,
  savedBlocks = [],
  onSaveBlock,
  onDeleteSavedBlock
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('essentials');

  const allBlocks = useMemo(() => {
    const templateBlocks = SMART_BLOCK_TEMPLATES;
    const userSavedBlocks = savedBlocks.map(block => ({ ...block, category: 'saved' as const }));
    return [...templateBlocks, ...userSavedBlocks];
  }, [savedBlocks]);

  const filteredBlocks = useMemo(() => {
    return allBlocks.filter(block => {
      const matchesCategory = selectedCategory === 'all' || block.category === selectedCategory;
      const matchesSearch = searchQuery === '' || 
        block.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        block.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        block.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesCategory && matchesSearch;
    });
  }, [allBlocks, selectedCategory, searchQuery]);

  const handleAddSmartBlock = (smartBlock: SmartBlock) => {
    const emailBlocks: EmailBlock[] = smartBlock.template.blocks.map((blockTemplate, index) => ({
      id: crypto.randomUUID(),
      block_type: blockTemplate.block_type as any,
      content: blockTemplate.content,
      image_url: blockTemplate.image_url,
      cta_url: blockTemplate.cta_url,
      cta_text: blockTemplate.cta_text,
      order_index: index,
      campaign_id: '',
      source: 'template',
      persona_tag: smartBlock.name
    }));

    onAddBlocks(emailBlocks);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('smart-blocks-search')?.focus();
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">Smart Blocks</h2>
            <p className="text-sm text-muted-foreground">
              Drag and drop prebuilt content
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              id="smart-blocks-search"
              placeholder="Search blocks (press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Categories */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1">
          <TabsList className="grid w-full grid-cols-3 m-4 mb-2">
            <TabsTrigger value="essentials" className="text-xs">Essentials</TabsTrigger>
            <TabsTrigger value="promotions" className="text-xs">Promos</TabsTrigger>
            <TabsTrigger value="events" className="text-xs">Events</TabsTrigger>
          </TabsList>
          <TabsList className="grid w-full grid-cols-2 mx-4 mb-4">
            <TabsTrigger value="inspiration" className="text-xs">Education</TabsTrigger>
            <TabsTrigger value="saved" className="text-xs">Saved</TabsTrigger>
          </TabsList>

          {/* Block Grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-3">
              {filteredBlocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 opacity-50">
                    <Search className="w-full h-full" />
                  </div>
                  <p>No blocks found</p>
                  <p className="text-sm">Try a different search or category</p>
                </div>
              ) : (
                filteredBlocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    onAdd={() => handleAddSmartBlock(block)}
                    onSave={onSaveBlock}
                    onDelete={onDeleteSavedBlock}
                  />
                ))
              )}
            </div>
          </div>
        </Tabs>

        {/* Help Text */}
        <div className="p-4 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">💡 Quick Tips:</p>
            <p>• Press "/" to search quickly</p>
            <p>• Hover over blocks to see options</p>
            <p>• All content is fully editable after adding</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BlockCardProps {
  block: SmartBlock;
  onAdd: () => void;
  onSave?: (block: SmartBlock) => void;
  onDelete?: (blockId: string) => void;
}

const BlockCard: React.FC<BlockCardProps> = ({ block, onAdd, onSave, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative border rounded-lg p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer bg-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onAdd}
    >
      {/* Thumbnail placeholder */}
      <div className="w-full h-20 bg-muted/50 rounded mb-3 flex items-center justify-center">
        <div className="text-2xl opacity-60">
          {block.category === 'essentials' && '📝'}
          {block.category === 'promotions' && '💰'}
          {block.category === 'events' && '📅'}
          {block.category === 'inspiration' && '💡'}
          {block.category === 'saved' && '⭐'}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-sm leading-tight">{block.name}</h4>
          {block.isCustom && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(block.id);
                  }}
                  className="text-destructive"
                >
                  Delete Block
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          {block.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {block.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Action Button */}
        {isHovered && (
          <Button 
            size="sm" 
            className="w-full mt-3 h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Block{block.template.blocks.length > 1 ? 's' : ''}
          </Button>
        )}
      </div>

      {/* Save Button for non-saved blocks */}
      {!block.isCustom && onSave && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onSave(block);
          }}
          title="Save this block"
        >
          <Bookmark className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};