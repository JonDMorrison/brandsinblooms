import React, { useState, useEffect, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Plus, Bug } from 'lucide-react';
import { ClickToEditBlock } from './ClickToEditBlock';
import { HeaderBlock } from './blocks/HeaderBlock';
import { NewsletterHeaderBlock } from './blocks/NewsletterHeaderBlock';
import { TextBlock } from './blocks/TextBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { ImageTextBlock } from './blocks/ImageTextBlock';
import { DividerBlock } from './blocks/DividerBlock';
import { ButtonBlock } from './blocks/ButtonBlock';
import { SocialFollowBlock } from './blocks/SocialFollowBlock';
import { FooterBlock } from './blocks/FooterBlock';
import { MediaSelectorSidebar } from '@/components/crm/MediaSelectorSidebar';
import { useFooterSettings } from '@/hooks/useFooterSettings';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { SaveIndicator } from '@/components/crm/SaveIndicator';

interface ClickToEditEmailBuilderProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
  onOpenAddModal?: (afterIndex?: number) => void;
  generatingBlocks?: Set<string>;
  campaignName?: string;
}

export const ClickToEditEmailBuilder: React.FC<ClickToEditEmailBuilderProps> = ({
  blocks,
  onBlocksChange,
  onOpenAddModal,
  generatingBlocks = new Set(),
  campaignName
}) => {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>();
  const [saveError, setSaveError] = useState(false);
  
  // Debug state for MediaSelector
  const [debugMediaSelectorOpen, setDebugMediaSelectorOpen] = useState(false);
  
  // Create a dummy footer block for display (not included in the actual blocks array)
  const footerBlock: ContentBlock = {
    id: 'email-footer',
    type: 'footer',
    source: 'manual',
    visible: true,
    collapsed: false,
    textAlign: 'center',
    padding: 'medium'
  };

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
      layout: type === 'image-text' ? 'image-right' : undefined,
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
    console.log('🗑️ removeBlock called with id:', id);
    console.log('🗑️ Current blocks before removal:', blocks.map(b => ({ id: b.id, type: b.type })));
    const filteredBlocks = blocks.filter(block => block.id !== id);
    console.log('🗑️ Filtered blocks after removal:', filteredBlocks.map(b => ({ id: b.id, type: b.type })));
    onBlocksChange(filteredBlocks);
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
      case 'newsletter-header':
        return <NewsletterHeaderBlock {...props} isPreview={false} />;
      case 'text':
        // Use ImageTextBlock for text blocks that have images, image-centric layouts, or headlines
        const hasImageLayout = block.layout && ['two-column-left', 'two-column-right', 'image-left', 'image-right'].includes(block.layout);
        const hasHeadline = block.headline || block.title;
        if (block.imageUrl || hasImageLayout || hasHeadline) {
          return <ImageTextBlock {...props} isPreview={false} />;
        }
        return <TextBlock {...props} isPreview={false} />;
      case 'image':
        // Use ImageTextBlock for image blocks with two-column layouts
        const hasTwoColumnLayout = block.layout && ['two-column-left', 'two-column-right'].includes(block.layout);
        if (hasTwoColumnLayout) {
          return <ImageTextBlock {...props} isPreview={false} />;
        }
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
      case 'newsletter-header':
        return <NewsletterHeaderBlock {...props} isPreview={true} />;
      case 'text':
        // Use ImageTextBlock for text blocks that have images, image-centric layouts, or headlines
        const hasImageLayout = block.layout && ['two-column-left', 'two-column-right', 'image-left', 'image-right'].includes(block.layout);
        const hasHeadline = block.headline || block.title;
        if (block.imageUrl || hasImageLayout || hasHeadline) {
          return <ImageTextBlock {...props} isPreview={true} />;
        }
        return <TextBlock {...props} isPreview={true} />;
      case 'image':
        // Use ImageTextBlock for image blocks with two-column layouts
        const hasTwoColumnLayoutPreview = block.layout && ['two-column-left', 'two-column-right'].includes(block.layout);
        if (hasTwoColumnLayoutPreview) {
          return <ImageTextBlock {...props} isPreview={true} />;
        }
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
    const handleAddBlock = () => {
      console.log('Opening add modal for index:', afterIndex);
      if (onOpenAddModal) {
        onOpenAddModal(afterIndex);
      }
    };

    return (
      <div className="flex justify-center py-4">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 bg-background hover:bg-accent"
          onClick={handleAddBlock}
        >
          <Plus className="h-4 w-4" />
          Add Block
        </Button>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-2">
      
      {/* Add block button at top */}
      <AddBlockButton />

      {/* Render all blocks */}
      {blocks.map((block, index) => (
        <div key={block.id}>
          <ClickToEditBlock
            block={block}
            index={index}
            onUpdate={updateBlock}
            campaignName={campaignName}
            onRemove={removeBlock}
            onDuplicate={duplicateBlock}
            onMove={moveBlock}
            canMoveUp={index > 0}
            canMoveDown={index < blocks.length - 1}
            isGenerating={generatingBlocks.has(block.id)}
            allBlocks={blocks}
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


      {/* Auto-included Footer (always at bottom, cannot be deleted) */}
      <div className="border-t-2 border-dashed border-gray-300 mt-8 pt-4">
        <div className="text-center text-sm text-muted-foreground mb-2 uppercase tracking-wide">
          📧 Auto-Included Email Footer
        </div>
        <FooterBlock 
          block={footerBlock}
          onUpdate={() => {}} // Footer settings managed separately
          isPreview={true}
        />
      </div>

      {/* Debug MediaSelector */}
      {debugMediaSelectorOpen && (
        <MediaSelectorSidebar
          isOpen={debugMediaSelectorOpen}
          onClose={() => {
            console.log('[DEBUG] Closing debug MediaSelector');
            setDebugMediaSelectorOpen(false);
          }}
          onImageSelect={(imageUrl, metadata) => {
            console.log('[DEBUG] Image selected:', { imageUrl, metadata });
            setDebugMediaSelectorOpen(false);
          }}
          contentContext="Debug test"
        />
      )}
    </div>
  );
};