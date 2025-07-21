
import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SimpleBlockEditor } from './SimpleBlockEditor';
import { BlockLayoutModal, LayoutType } from './BlockLayoutModal';

interface CleanEmailBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
}

// Mapping function to convert layout types to block types and configurations
const mapLayoutToBlock = (layoutType: LayoutType): { type: ContentBlock['type']; config: Partial<ContentBlock> } => {
  switch (layoutType) {
    case 'header-hero':
      return {
        type: 'header',
        config: {
          headline: 'Your Feature Banner',
          body: 'Create an eye-catching hero section with background image and overlay text',
          alignment: 'center',
          padding: 'large',
          backgroundImageUrl: '',
          backgroundOpacity: 70
        }
      };
    case 'header-simple':
      return {
        type: 'header',
        config: {
          headline: 'Your Header Title',
          body: 'Add your subtitle or description here...',
          alignment: 'center',
          padding: 'medium'
        }
      };
    case 'image-full':
      return {
        type: 'image',
        config: {
          title: 'Full-Width Image',
          altText: 'Image description',
          caption: 'Optional caption text',
          alignment: 'center',
          layout: 'full-width'
        }
      };
    case 'image-left':
      return {
        type: 'image',
        config: {
          title: 'Image & Text Section',
          content: 'Add your descriptive text here...',
          altText: 'Image description',
          alignment: 'left',
          layout: 'two-column-left'
        }
      };
    case 'image-right':
      return {
        type: 'image',
        config: {
          title: 'Text & Image Section',
          content: 'Add your descriptive text here...',
          altText: 'Image description',
          alignment: 'right',
          layout: 'two-column-right'
        }
      };
    case 'button-centered':
      return {
        type: 'button',
        config: {
          heading: 'Ready to take action?',
          body: 'Click the button below to get started.',
          buttonText: 'Get Started',
          buttonUrl: '',
          alignment: 'center',
          padding: 'medium'
        }
      };
    case 'button-left':
      return {
        type: 'button',
        config: {
          heading: 'Take Action',
          body: 'Learn more about our services.',
          buttonText: 'Learn More',
          buttonUrl: '',
          alignment: 'left',
          padding: 'medium'
        }
      };
    case 'button-right':
      return {
        type: 'button',
        config: {
          heading: 'Get Started Today',
          body: 'Join thousands of satisfied customers.',
          buttonText: 'Join Now',
          buttonUrl: '',
          alignment: 'right',
          padding: 'medium'
        }
      };
    case 'text-double':
      return {
        type: 'text',
        config: {
          title: 'Two Column Text',
          content: 'Column 1 content goes here...\n\nColumn 2 content goes here...',
          layout: 'two-column-left',
          alignment: 'left'
        }
      };
    case 'text-triple':
      return {
        type: 'text',
        config: {
          title: 'Three Column Text',
          content: 'Column 1 content...\n\nColumn 2 content...\n\nColumn 3 content...',
          alignment: 'left'
        }
      };
    default:
      return {
        type: 'text',
        config: {
          title: 'Text Section',
          content: 'Add your content here...'
        }
      };
  }
};

export const CleanEmailBlockEditor: React.FC<CleanEmailBlockEditorProps> = ({
  blocks,
  onBlocksChange
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  const addBlockWithLayout = (layoutType: LayoutType, index?: number) => {
    console.log('Adding block with layout:', layoutType);
    
    const { type, config } = mapLayoutToBlock(layoutType);
    
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
      alignment: 'left',
      padding: 'medium',
      margin: 'medium',
      responsiveBehavior: 'stack',
      visible: true,
      animation: 'fade-in',
      // Apply layout-specific configuration
      ...config
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

  const handleModalAddBlock = (layoutType: LayoutType) => {
    addBlockWithLayout(layoutType, insertIndex ?? undefined);
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
              Choose from professional layouts to create engaging content blocks.
            </p>
            <Button onClick={() => openAddModal()}>
              Choose Layout
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Block Layout Modal */}
      <BlockLayoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleModalAddBlock}
      />
    </div>
  );
};
