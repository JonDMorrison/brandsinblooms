
import React from 'react';
import { ContentBlock, BlockLayout } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BlockLayoutModal, LayoutType } from './BlockLayoutModal';
import { LayoutPreview, mapModalLayoutToBlockLayout, determineBlockTypeFromLayout } from './LayoutRenderer';
import { EnhancedBlockEditor } from './EnhancedBlockEditor';
import { Plus } from 'lucide-react';

interface EmailBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
}

export const EmailBlockEditor: React.FC<EmailBlockEditorProps> = ({
  blocks,
  onBlocksChange
}) => {
  const addBlock = (type: ContentBlock['type']) => {
    console.log('Adding block of type:', type);
    const newBlock: ContentBlock = {
      id: `block_${Date.now()}`,
      type,
      layout: 'full-width',
      title: '',
      content: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'manual',
      collapsed: false, // New blocks start expanded
      alignment: type === 'header' ? 'center' : 'left', // Smart defaults
      padding: 'medium',
      margin: 'medium',
      responsiveBehavior: 'stack'
    };
    onBlocksChange([...blocks, newBlock]);
  };

  const addBlockWithLayout = (layoutType: LayoutType) => {
    console.log('Adding block with layout:', layoutType);
    
    const blockType = determineBlockTypeFromLayout(layoutType);
    const blockLayout = mapModalLayoutToBlockLayout(layoutType);
    
    const newBlock: ContentBlock = {
      id: `block_${Date.now()}`,
      type: blockType,
      layout: blockLayout,
      title: '',
      content: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'manual',
      collapsed: false,
      alignment: blockType === 'header' ? 'center' : 'left',
      padding: 'medium',
      margin: 'medium',
      responsiveBehavior: 'stack'
    };
    onBlocksChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    console.log('Updating block:', id, 'with updates:', updates);
    onBlocksChange(blocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    ));
  };

  const removeBlock = (id: string) => {
    onBlocksChange(blocks.filter(block => block.id !== id));
  };

  const duplicateBlock = (block: ContentBlock) => {
    const newBlock: ContentBlock = {
      ...block,
      id: `block_${Date.now()}`,
      title: `${block.title} (Copy)`,
      collapsed: false // Duplicated blocks start expanded
    };
    const blockIndex = blocks.findIndex(b => b.id === block.id);
    const newBlocks = [...blocks];
    newBlocks.splice(blockIndex + 1, 0, newBlock);
    onBlocksChange(newBlocks);
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const currentIndex = blocks.findIndex(block => block.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === blocks.length - 1)
    ) {
      return;
    }

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [newBlocks[currentIndex], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[currentIndex]];
    onBlocksChange(newBlocks);
  };

  return (
    <div className="space-y-6">
      {/* Add Block Section */}
      <Card>
        <CardHeader>
          <CardTitle>Add Content Block</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Layout-based Block Creation */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Choose Layout</Label>
              <BlockLayoutModal 
                onSelect={addBlockWithLayout}
                triggerText="Add Block with Layout"
              />
            </div>
            
            {/* Traditional Block Type Creation */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Or Choose Block Type</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { type: 'header' as const, label: 'Header', icon: '📄' },
                  { type: 'text' as const, label: 'Text', icon: '📝' },
                  { type: 'image' as const, label: 'Image', icon: '🖼️' },
                  { type: 'button' as const, label: 'Button', icon: '🔘' }
                ].map(({ type, label, icon }) => (
                  <Button
                    key={type}
                    variant="outline"
                    onClick={() => addBlock(type)}
                    className="h-16 flex flex-col gap-1"
                  >
                    <span className="text-xl">{icon}</span>
                    <span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Blocks - Enhanced Editors */}
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <EnhancedBlockEditor
            key={block.id}
            block={block}
            index={index}
            onUpdate={updateBlock}
            onRemove={removeBlock}
            onDuplicate={duplicateBlock}
            onMove={moveBlock}
            canMoveUp={index > 0}
            canMoveDown={index < blocks.length - 1}
          />
        ))}
      </div>

      {blocks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No content blocks yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first content block to start building your email campaign.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
