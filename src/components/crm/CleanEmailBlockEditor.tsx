
import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SimpleBlockEditor } from './SimpleBlockEditor';
import { AddBlockModal } from './AddBlockModal';

interface CleanEmailBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
}

export const CleanEmailBlockEditor: React.FC<CleanEmailBlockEditorProps> = ({
  blocks,
  onBlocksChange
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const addBlock = (type: ContentBlock['type'], index?: number) => {
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
    
    if (index !== undefined) {
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      onBlocksChange(newBlocks);
    } else {
      onBlocksChange([...blocks, newBlock]);
    }
  };

  const openAddModal = (index?: number) => {
    setInsertIndex(index ?? null);
    setIsModalOpen(true);
  };

  const handleModalAddBlock = (type: ContentBlock['type']) => {
    addBlock(type, insertIndex ?? undefined);
    setIsModalOpen(false);
    setInsertIndex(null);
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
      {/* Content Blocks */}
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div key={block.id} className="space-y-3">
            <SimpleBlockEditor
              block={block}
              index={index}
              onUpdate={updateBlock}
              onRemove={removeBlock}
              onDuplicate={duplicateBlock}
              onMove={moveBlock}
              canMoveUp={index > 0}
              canMoveDown={index < blocks.length - 1}
            />
            {/* Add Block Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openAddModal(index)}
                className="h-8 w-8 p-0 rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {blocks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Start building your email</h3>
            <p className="text-muted-foreground mb-4">
              Click the button below to add your first content block.
            </p>
            <Button onClick={() => openAddModal()}>
              Add First Block
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Block Modal */}
      <AddBlockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddBlock={handleModalAddBlock}
      />
    </div>
  );
};
