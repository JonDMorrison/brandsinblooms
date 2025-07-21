
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { SimpleBlockEditor } from './SimpleBlockEditor';
import { QuickAddBlocks } from './QuickAddBlocks';

interface CleanEmailBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
}

export const CleanEmailBlockEditor: React.FC<CleanEmailBlockEditorProps> = ({
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
      collapsed: false,
      alignment: type === 'header' ? 'center' : 'left',
      padding: 'medium',
      margin: 'medium',
      responsiveBehavior: 'stack',
      visible: true,
      animation: 'fade-in',
      // Smart defaults based on block type
      ...(type === 'header' && {
        headline: 'Your Header Title',
        body: 'Add your subtitle or description here...'
      }),
      ...(type === 'text' && {
        title: 'Text Section',
        content: 'Add your content here...'
      }),
      ...(type === 'button' && {
        buttonText: 'Click Here',
        heading: 'Ready to take action?',
        body: 'Click the button below to get started.'
      }),
      ...(type === 'image' && {
        altText: 'Image description',
        caption: ''
      }),
      ...(type === 'product' && {
        title: 'Product Name',
        content: 'Product description goes here...',
        buttonText: 'Shop Now',
        ctaText: '$99.99'
      })
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
      title: block.title ? `${block.title} (Copy)` : block.title,
      headline: block.headline ? `${block.headline} (Copy)` : block.headline,
      collapsed: false
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
    <div className="space-y-4">
      {/* Quick Add Blocks */}
      <QuickAddBlocks onAddBlock={addBlock} />

      {/* Content Blocks */}
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <SimpleBlockEditor
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

      {/* Empty State */}
      {blocks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Start building your email</h3>
            <p className="text-muted-foreground mb-4">
              Add your first content block using the options above.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
