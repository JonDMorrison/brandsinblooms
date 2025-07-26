
import React, { useState, useEffect } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ClickToEditEmailBuilder } from './click-to-edit/ClickToEditEmailBuilder';
import { BlockLayoutModal, LayoutType } from './BlockLayoutModal';
import { mediaSelector } from '@/utils/mediaSelector';

interface CleanEmailBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
}

// Enhanced mapping function to convert layout types to block types and configurations
const mapLayoutToBlock = async (layoutType: LayoutType): Promise<{ type: ContentBlock['type']; config: Partial<ContentBlock> }> => {
  switch (layoutType) {
    // Newsletter-specific layouts
    case 'newsletter-header':
      return {
        type: 'newsletter-header',
        config: {
          title: 'Newsletter Title',
          subtitle: 'Weekly insights and updates',
          issueNumber: '#001',
          publishDate: new Date().toLocaleDateString(),
          backgroundImageUrl: '',
          alignment: 'center',
          padding: 'large'
        }
      };
    case 'quote-featured':
      return {
        type: 'quote',
        config: {
          quote: 'Add an inspiring quote here...',
          author: 'Author Name',
          authorTitle: 'Title or Company',
          alignment: 'center',
          padding: 'large'
        }
      };
    case 'cta-primary':
      return {
        type: 'cta',
        config: {
          heading: 'Take Action Today',
          body: 'Don\'t miss out on this opportunity. Join thousands of satisfied customers.',
          ctaText: 'Get Started',
          ctaUrl: '',
          ctaStyle: 'primary',
          ctaSize: 'large',
          alignment: 'center',
          padding: 'large'
        }
      };
    // Enhanced image layouts
    case 'image-60-40':
      const image6040 = await mediaSelector({ 
        prompt: 'beautiful garden flowers plants',
        count: 1 
      });
      return {
        type: 'image',
        config: {
          title: 'Image Focus Layout',
          content: 'Supporting text content...',
          altText: image6040.alt || 'Garden content',
          layout: 'image-60-40',
          imageUrl: image6040.url,
          alignment: 'left'
        }
      };
    case 'image-70-30':
      const image7030 = await mediaSelector({ 
        prompt: 'gardening landscape design',
        count: 1 
      });
      return {
        type: 'image',
        config: {
          title: 'Image Dominant Layout',
          content: 'Complementary text...',
          altText: image7030.alt || 'Landscape design',
          layout: 'image-70-30',
          imageUrl: image7030.url,
          alignment: 'left'
        }
      };
    case 'image-overlay':
      const overlayImage = await mediaSelector({ 
        prompt: 'stunning garden landscape background',
        count: 1 
      });
      return {
        type: 'image',
        config: {
          title: 'Overlay Text',
          content: 'Text overlaid on image background',
          altText: overlayImage.alt || 'Garden background',
          layout: 'overlay',
          imageUrl: overlayImage.url,
          backgroundOpacity: 60,
          alignment: 'center'
        }
      };
    case 'image-background':
      const bgImage = await mediaSelector({ 
        prompt: 'natural garden background texture',
        count: 1 
      });
      return {
        type: 'image',
        config: {
          title: 'Background Image Section',
          content: 'Content with background image',
          altText: bgImage.alt || 'Garden background',
          layout: 'background',
          backgroundImageUrl: bgImage.url,
          backgroundOpacity: 30,
          alignment: 'center'
        }
      };
    // Original layouts (enhanced)
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
      const fullWidthImage = await mediaSelector({ 
        prompt: 'garden center nursery plants',
        count: 1 
      });
      return {
        type: 'image',
        config: {
          title: 'Full-Width Image',
          altText: fullWidthImage.alt || 'Garden center plants',
          caption: 'Optional caption text',
          alignment: 'center',
          layout: 'full-width',
          imageUrl: fullWidthImage.url
        }
      };
    case 'image-left':
      const leftImage = await mediaSelector({ 
        prompt: 'beautiful garden flowers plants',
        count: 1 
      });
      return {
        type: 'image',
        config: {
          title: 'Image & Text Section',
          content: 'Add your descriptive text here...',
          altText: leftImage.alt || 'Garden flowers and plants',
          alignment: 'left',
          layout: 'two-column-left',
          imageUrl: leftImage.url
        }
      };
    case 'image-right':
      const rightImage = await mediaSelector({ 
        prompt: 'gardening tools plants nursery',
        count: 1 
      });
      return {
        type: 'image',
        config: {
          title: 'Text & Image Section',
          content: 'Add your descriptive text here...',
          altText: rightImage.alt || 'Gardening tools and plants',
          alignment: 'right',
          layout: 'two-column-right',
          imageUrl: rightImage.url
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
  const [internalBlocks, setInternalBlocks] = useState<ContentBlock[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  console.log('📧 CleanEmailBlockEditor received blocks:', {
    count: blocks.length,
    internalCount: internalBlocks.length,
    blocks: blocks.map(b => ({
      id: b.id,
      type: b.type,
      title: b.title || b.headline,
      hasContent: !!(b.content || b.body),
      visible: b.visible,
      source: b.source
    }))
  });

  // Sync internal state with parent blocks prop only if they're different
  useEffect(() => {
    // Only sync if blocks actually changed to prevent unnecessary re-renders
    if (JSON.stringify(blocks) !== JSON.stringify(internalBlocks)) {
      console.log("🔄 Syncing blocks - parent has:", blocks.length, "internal has:", internalBlocks.length);
      setInternalBlocks(blocks);
      console.log("✅ Synced blocks into internal state:", blocks.length, "blocks");
    }
  }, [blocks, internalBlocks]);

  const addBlockWithLayout = async (layoutType: LayoutType, index?: number) => {
    console.log('🔧 Adding block with layout:', layoutType, 'at index:', index);
    
    try {
      const { type, config } = await mapLayoutToBlock(layoutType);
      
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
        const newBlocks = [...internalBlocks];
        newBlocks.splice(index + 1, 0, newBlock);
        setInternalBlocks(newBlocks);
        onBlocksChange(newBlocks);
      } else {
        const newBlocks = [...internalBlocks, newBlock];
        setInternalBlocks(newBlocks);
        onBlocksChange(newBlocks);
      }
    } catch (error) {
      console.error('Error adding block with layout:', error);
      // Fallback to adding block without auto-image
      const fallbackConfig = layoutType.includes('image') ? {
        type: 'image' as const,
        config: {
          title: 'Image Section',
          content: 'Add your descriptive text here...',
          altText: 'Image description',
          alignment: 'left' as const,
          layout: 'full-width' as const
        }
      } : { type: 'text' as const, config: {} };
      
      const newBlock: ContentBlock = {
        id: `block_${Date.now()}`,
        type: fallbackConfig.type,
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
        ...fallbackConfig.config
      };
      
      if (index !== undefined) {
        const newBlocks = [...internalBlocks];
        newBlocks.splice(index + 1, 0, newBlock);
        setInternalBlocks(newBlocks);
        onBlocksChange(newBlocks);
      } else {
        const newBlocks = [...internalBlocks, newBlock];
        setInternalBlocks(newBlocks);
        onBlocksChange(newBlocks);
      }
    }
  };

  const openAddModal = (index?: number) => {
    setInsertIndex(index ?? null);
    setIsModalOpen(true);
  };

  const handleModalAddBlock = async (layoutType: LayoutType) => {
    console.log('📝 handleModalAddBlock called with:', layoutType, 'insertIndex:', insertIndex);
    await addBlockWithLayout(layoutType, insertIndex ?? undefined);
    setIsModalOpen(false);
    setInsertIndex(null);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    console.log('Updating block:', id, 'with updates:', updates);
    const newBlocks = internalBlocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    );
    setInternalBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  const removeBlock = (id: string) => {
    const newBlocks = internalBlocks.filter(block => block.id !== id);
    setInternalBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  const duplicateBlock = (block: ContentBlock) => {
    const newBlock: ContentBlock = {
      ...block,
      id: `block_${Date.now()}`,
      title: block.title ? `${block.title} (Copy)` : block.title,
      headline: block.headline ? `${block.headline} (Copy)` : block.headline,
      collapsed: false
    };
    const blockIndex = internalBlocks.findIndex(b => b.id === block.id);
    const newBlocks = [...internalBlocks];
    newBlocks.splice(blockIndex + 1, 0, newBlock);
    setInternalBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const currentIndex = internalBlocks.findIndex(block => block.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === internalBlocks.length - 1)
    ) {
      return;
    }

    const newBlocks = [...internalBlocks];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [newBlocks[currentIndex], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[currentIndex]];
    setInternalBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  // Show loading only during initial mount when blocks are expected but not loaded
  const isInitialLoading = blocks.length > 0 && internalBlocks.length === 0;
  if (isInitialLoading) {
    console.log("🔄 Showing loading state - parent blocks:", blocks.length, "internal:", internalBlocks.length);
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin h-8 w-8 mx-auto mb-4 border-2 border-primary border-t-transparent rounded-full"></div>
            <p className="text-muted-foreground">Loading content blocks...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Click-to-Edit Email Builder */}
      <ClickToEditEmailBuilder
        blocks={internalBlocks}
        onBlocksChange={(newBlocks) => {
          setInternalBlocks(newBlocks);
          onBlocksChange(newBlocks);
        }}
      />

      {/* Empty State */}
      {internalBlocks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Start building your email</h3>
            <p className="text-muted-foreground mb-4">
              Choose from professional layouts to create engaging content blocks.
            </p>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Choose Layout button clicked');
                openAddModal();
              }}
            >
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
