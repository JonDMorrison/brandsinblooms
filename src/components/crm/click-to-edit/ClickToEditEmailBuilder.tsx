import React, { useState, useEffect, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ClickToEditBlock } from './ClickToEditBlock';
import { HeaderBlock } from './blocks/HeaderBlock';
import { TextBlock } from './blocks/TextBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { ImageTextBlock } from './blocks/ImageTextBlock';
import { DividerBlock } from './blocks/DividerBlock';
import { ButtonBlock } from './blocks/ButtonBlock';
import { SocialFollowBlock } from './blocks/SocialFollowBlock';
import { FooterBlock } from './blocks/FooterBlock';
import { SaveIndicator } from '@/components/crm/SaveIndicator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ClickToEditEmailBuilderProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
}

export const ClickToEditEmailBuilder: React.FC<ClickToEditEmailBuilderProps> = ({
  blocks,
  onBlocksChange
}) => {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>();
  const [saveError, setSaveError] = useState(false);

  // Auto-save to localStorage with debouncing
  const debouncedSave = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (blocksToSave: ContentBlock[]) => {
        clearTimeout(timeoutId);
        setSaving(true);
        setSaveError(false);
        
        timeoutId = setTimeout(() => {
          try {
            localStorage.setItem('emailBuilder_draft', JSON.stringify({
              blocks: blocksToSave,
              timestamp: Date.now()
            }));
            setLastSaved(new Date());
            setSaveError(false);
          } catch (error) {
            console.warn('Failed to save draft to localStorage:', error);
            setSaveError(true);
          } finally {
            setSaving(false);
          }
        }, 500);
      };
    })(),
    []
  );

  // Auto-save whenever blocks change
  useEffect(() => {
    if (blocks.length > 0) {
      debouncedSave(blocks);
    }
  }, [blocks, debouncedSave]);
  const createBlock = (type: ContentBlock['type'], afterIndex?: number): ContentBlock => {
    const id = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const baseBlock: ContentBlock = {
      id,
      type,
      source: 'manual',
      visible: true,
      collapsed: false,
      layout: type === 'image-text' ? 'image-left' : undefined,
      textAlign: 'left',
      padding: 'medium'
    };

    return baseBlock;
  };

  const addBlock = (type: ContentBlock['type'], afterIndex?: number) => {
    const newBlock = createBlock(type);
    const newBlocks = [...blocks];
    
    if (afterIndex !== undefined) {
      newBlocks.splice(afterIndex + 1, 0, newBlock);
    } else {
      newBlocks.push(newBlock);
    }
    
    onBlocksChange(newBlocks);
  };

  const updateBlock = useCallback((id: string, updates: Partial<ContentBlock>) => {
    const newBlocks = blocks.map(block =>
      block.id === id ? { ...block, ...updates } : block
    );
    onBlocksChange(newBlocks);
  }, [blocks, onBlocksChange]);

  const removeBlock = (id: string) => {
    onBlocksChange(blocks.filter(block => block.id !== id));
  };

  const duplicateBlock = (block: ContentBlock) => {
    const newBlock = {
      ...block,
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    const blockIndex = blocks.findIndex(b => b.id === block.id);
    const newBlocks = [...blocks];
    newBlocks.splice(blockIndex + 1, 0, newBlock);
    onBlocksChange(newBlocks);
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const currentIndex = blocks.findIndex(block => block.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    const [movedBlock] = newBlocks.splice(currentIndex, 1);
    newBlocks.splice(newIndex, 0, movedBlock);
    onBlocksChange(newBlocks);
  };

  const renderBlock = (block: ContentBlock) => {
    const props = {
      block,
      onUpdate: (updates: Partial<ContentBlock>) => updateBlock(block.id, updates)
    };

    switch (block.type) {
      case 'header':
        return <HeaderBlock {...props} isPreview={false} />;
      case 'text':
        return <TextBlock {...props} isPreview={false} />;
      case 'image':
        return <ImageBlock {...props} isPreview={false} />;
      case 'image-text':
        return <ImageTextBlock {...props} isPreview={false} />;
      case 'divider':
        return <DividerBlock {...props} isPreview={false} />;
      case 'button':
        return <ButtonBlock {...props} isPreview={false} />;
      case 'social-follow':
        return <SocialFollowBlock {...props} isPreview={false} />;
      case 'footer':
        return <FooterBlock {...props} isPreview={false} />;
      default:
        return <div>Unknown block type</div>;
    }
  };

  const renderBlockPreview = (block: ContentBlock) => {
    const props = {
      block,
      onUpdate: (updates: Partial<ContentBlock>) => updateBlock(block.id, updates)
    };

    switch (block.type) {
      case 'header':
        return <HeaderBlock {...props} isPreview={true} />;
      case 'text':
        return <TextBlock {...props} isPreview={true} />;
      case 'image':
        return <ImageBlock {...props} isPreview={true} />;
      case 'image-text':
        return <ImageTextBlock {...props} isPreview={true} />;
      case 'divider':
        return <DividerBlock {...props} isPreview={true} />;
      case 'button':
        return <ButtonBlock {...props} isPreview={true} />;
      case 'social-follow':
        return <SocialFollowBlock {...props} isPreview={true} />;
      case 'footer':
        return <FooterBlock {...props} isPreview={true} />;
      default:
        return <div>Unknown block type</div>;
    }
  };

  const AddBlockButton: React.FC<{ afterIndex?: number }> = ({ afterIndex }) => {
    const handleAddBlock = (type: ContentBlock['type']) => {
      console.log('Adding block:', type, 'after index:', afterIndex);
      addBlock(type, afterIndex);
    };

    return (
      <div className="flex justify-center py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-background hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              Add Block
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="z-[9999] bg-background border shadow-lg min-w-[160px]" 
            align="center"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuItem 
              onClick={() => handleAddBlock('header')}
              className="cursor-pointer"
            >
              📄 Header
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleAddBlock('text')}
              className="cursor-pointer"
            >
              📝 Text
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleAddBlock('image')}
              className="cursor-pointer"
            >
              🖼️ Image
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleAddBlock('image-text')}
              className="cursor-pointer"
            >
              📄 Image + Text
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleAddBlock('button')}
              className="cursor-pointer"
            >
              🔘 Button
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleAddBlock('divider')}
              className="cursor-pointer"
            >
              ➖ Divider
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleAddBlock('social-follow')}
              className="cursor-pointer"
            >
              📱 Social Follow
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleAddBlock('footer')}
              className="cursor-pointer"
            >
              📋 Footer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-2">
      {/* Save status indicator */}
      <div className="flex justify-end mb-4">
        <SaveIndicator 
          saving={saving} 
          lastSaved={lastSaved} 
          error={saveError}
        />
      </div>
      
      {/* Add block button at top */}
      <AddBlockButton />

      {/* Render all blocks */}
      {blocks.map((block, index) => (
        <div key={block.id}>
          <ClickToEditBlock
            block={block}
            index={index}
            onUpdate={updateBlock}
            onRemove={removeBlock}
            onDuplicate={duplicateBlock}
            onMove={moveBlock}
            canMoveUp={index > 0}
            canMoveDown={index < blocks.length - 1}
          >
            {{
              preview: renderBlockPreview(block),
              editor: renderBlock(block)
            }}
          </ClickToEditBlock>
          
          {/* Add block button between blocks */}
          <AddBlockButton afterIndex={index} />
        </div>
      ))}

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-6xl mb-4">📧</div>
          <h3 className="text-lg font-medium mb-2">Start building your email</h3>
          <p className="text-sm mb-4">Add your first content block to get started</p>
        </div>
      )}
    </div>
  );
};