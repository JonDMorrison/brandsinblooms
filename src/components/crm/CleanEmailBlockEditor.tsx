
import React, { useState, useEffect } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ClickToEditEmailBuilder } from './click-to-edit/ClickToEditEmailBuilder';
import { FooterBlock } from './click-to-edit/blocks/FooterBlock';
import { BlockLayoutModal, LayoutType } from './BlockLayoutModal';
import { mediaSelector } from '@/utils/mediaSelector';
import { RegenerateBlockButton } from './RegenerateBlockButton';

interface CleanEmailBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
  generatingBlocks?: Set<string>;
  campaignName?: string;
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
    // Enhanced image layouts
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
  onBlocksChange,
  generatingBlocks = new Set(),
  campaignName
}) => {
  const [internalBlocks, setInternalBlocks] = useState<ContentBlock[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [hydrationComplete, setHydrationComplete] = useState(false);

  console.log('📧 CleanEmailBlockEditor received blocks:', {
    count: blocks.length,
    internalCount: internalBlocks.length,
    hydrationComplete,
    blocks: blocks.map(b => ({
      id: b.id,
      type: b.type,
      title: b.title || b.headline,
      hasContent: !!(b.content || b.body),
      imageUrl: b.imageUrl,
      visible: b.visible,
      source: b.source
    }))
  });

  // Enhanced hydration logic with proper state management
  useEffect(() => {
    // Skip if no blocks provided yet
    if (blocks.length === 0) {
      if (internalBlocks.length > 0) {
        setInternalBlocks([]);
        setHydrationComplete(true);
      }
      return;
    }

    // Create content signatures to detect meaningful changes
    const createContentSignature = (block: ContentBlock) => {
      const title = block.title || block.headline || '';
      const content = block.content || block.body || '';
      const imageUrl = block.imageUrl || '';
      const buttonText = block.buttonText || block.ctaText || '';
      const buttonUrl = block.buttonUrl || block.ctaUrl || '';
      const visible = block.visible !== false;
      // Ensure content is a string before calling slice
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content || '');
      return `${block.id}:${block.type}:${title}:${contentStr.slice(0, 50)}:${imageUrl}:${buttonText}:${buttonUrl}:${visible}`;
    };

    const currentSignature = internalBlocks.map(createContentSignature).sort().join('|');
    const newSignature = blocks.map(createContentSignature).sort().join('|');
    
    if (currentSignature !== newSignature || !hydrationComplete) {
      console.log("🔄 Syncing blocks - content changed. Parent:", blocks.length, "Internal:", internalBlocks.length);
      console.log("📋 Content signatures differ:", {
        current: currentSignature.slice(0, 100) + '...',
        new: newSignature.slice(0, 100) + '...'
      });
      
      // Create deep copy to prevent reference issues
      const hydratedBlocks = blocks.map(block => {
      const hydratedBlock = {
          ...block,
          // Normalize field names for consistency across the app
          headline: block.headline || block.heading || block.title || '',
          body: block.body || block.content || '',
          title: block.title || block.headline || block.heading || 'Untitled',
          content: block.content || block.body || '',
          // Preserve newsletter-specific fields
          subtitle: block.subtitle || '',
          issueNumber: block.issueNumber || '',
          publishDate: block.publishDate || '',
          backgroundImageUrl: block.backgroundImageUrl || '',
          // Lift nested imageUrl to top level if missing at top level
          imageUrl: block.imageUrl || 
                   (typeof block.content === 'object' && block.content && (block.content as any).imageUrl) || 
                   '',
          altText: block.altText || 
                  (typeof block.content === 'object' && block.content && (block.content as any).altText) || 
                  '',
          // CRITICAL: Normalize CTA fields bidirectionally to prevent rendering issues
          ctaText: block.ctaText || block.buttonText || '',
          ctaUrl: block.ctaUrl || block.buttonUrl || '',
          buttonText: block.buttonText || block.ctaText || '',
          buttonUrl: block.buttonUrl || block.ctaUrl || '',
          visible: block.visible !== false,
          collapsed: block.collapsed || false
        };
        
        console.log('🧱 Hydrating block:', {
          id: block.id,
          type: block.type,
          originalImageUrl: block.imageUrl,
          hydratedImageUrl: hydratedBlock.imageUrl,
          title: hydratedBlock.title,
          hasContent: !!(hydratedBlock.content || hydratedBlock.body)
        });
        
        return hydratedBlock;
      });
      
      setInternalBlocks(hydratedBlocks);
      setHydrationComplete(true);
      console.log("✅ Synced blocks into internal state:", hydratedBlocks.length, "blocks");
      
      // Force re-render after hydration to ensure components update
      setTimeout(() => {
        console.log('🔄 Forcing component re-render after hydration');
        setInternalBlocks([...hydratedBlocks]);
      }, 50);
    }
  }, [blocks, internalBlocks, hydrationComplete]);

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
      
      const newBlocks = [...internalBlocks];
      // When index is -1, insert at start (position 0)
      // When index is a number >= 0, insert after that index (position index + 1)
      // When index is undefined, insert at end
      const insertAt = index !== undefined ? (index === -1 ? 0 : index + 1) : newBlocks.length;
      newBlocks.splice(insertAt, 0, newBlock);
      setInternalBlocks(newBlocks);
      onBlocksChange(newBlocks);
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
      
      const newBlocks = [...internalBlocks];
      // When index is -1, insert at start (position 0)
      // When index is a number >= 0, insert after that index (position index + 1)
      // When index is undefined, insert at end
      const insertAt = index !== undefined ? (index === -1 ? 0 : index + 1) : newBlocks.length;
      newBlocks.splice(insertAt, 0, newBlock);
      setInternalBlocks(newBlocks);
      onBlocksChange(newBlocks);
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
    console.log('🔧 Updating block:', id, 'with updates:', updates);
    const newBlocks = internalBlocks.map(block => {
      if (block.id === id) {
        // Simply merge updates at top level
        const updatedBlock: ContentBlock = { ...block, ...updates };
        
        console.log('🧱 Block after update:', {
          id: updatedBlock.id,
          type: updatedBlock.type,
          title: updatedBlock.title,
          subtitle: updatedBlock.subtitle,
          issueNumber: updatedBlock.issueNumber,
          publishDate: updatedBlock.publishDate
        });
        return updatedBlock;
      }
      return block;
    });
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

  // Show loading only when hydrating existing blocks, not for empty campaigns
  const isInitialLoading = !hydrationComplete && blocks.length > 0 && internalBlocks.length === 0;
  if (isInitialLoading) {
    console.log("🔄 Showing loading state - parent blocks:", blocks.length, "internal:", internalBlocks.length, "hydration:", hydrationComplete);
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin h-8 w-8 mx-auto mb-4 border-2 border-primary border-t-transparent rounded-full"></div>
            <p className="text-muted-foreground">Loading email builder...</p>
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
        onOpenAddModal={openAddModal}
        generatingBlocks={generatingBlocks}
        campaignName={campaignName}
      />


      {/* Block Layout Modal */}
      <BlockLayoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleModalAddBlock}
      />
    </div>
  );
};
