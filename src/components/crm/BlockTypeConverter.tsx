
import React, { useState } from 'react';
import { ContentBlock, BlockType, BlockLayout } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { BlockLayoutModal, LayoutType } from './BlockLayoutModal';
import { mapModalLayoutToBlockLayout, determineBlockTypeFromLayout } from './LayoutRenderer';
import { RefreshCw, Layout } from 'lucide-react';

interface BlockTypeConverterProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
}

const blockTypeOptions = [
  { value: 'header', label: 'Header', icon: '📄' },
  { value: 'newsletter-header', label: 'Newsletter Header', icon: '📰' },
  { value: 'text', label: 'Text', icon: '📝' },
  { value: 'image', label: 'Image', icon: '🖼️' },
  { value: 'button', label: 'Button', icon: '🔘' },
  { value: 'divider', label: 'Divider', icon: '➖' },
  { value: 'product', label: 'Product', icon: '📦' }
];

export const BlockTypeConverter: React.FC<BlockTypeConverterProps> = ({ 
  block, 
  onUpdate 
}) => {
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const handleTypeChange = (newType: BlockType) => {
    console.log('Converting block type from', block.type, 'to', newType);
    
    // Preserve content during type conversion
    const preservedContent = preserveContentDuringTypeChange(block, newType);
    
    onUpdate({
      type: newType,
      ...preservedContent
    });
  };

  const handleLayoutChange = (layoutType: LayoutType) => {
    console.log('Changing block layout to:', layoutType);
    
    const newBlockType = determineBlockTypeFromLayout(layoutType);
    const newBlockLayout = mapModalLayoutToBlockLayout(layoutType);
    
    // Force image-text type for two-column layouts
    const finalBlockType = (newBlockLayout === 'two-column-left' || newBlockLayout === 'two-column-right') 
      ? 'image-text' 
      : newBlockType;
    
    // Preserve content during layout change
    const preservedContent = preserveContentDuringLayoutChange(block, finalBlockType, newBlockLayout);
    
    onUpdate({
      type: finalBlockType,
      layout: newBlockLayout,
      ...preservedContent
    });
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Convert to:</span>
        <NativeSelect
          value={block.type}
          onChange={(e) => handleTypeChange(e.target.value as BlockType)}
          className="w-36 h-8"
          options={blockTypeOptions.map((option) => ({
            value: option.value,
            label: `${option.icon} ${option.label}`
          }))}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <Layout className="h-4 w-4 text-muted-foreground" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLayoutModalOpen(true)}
        >
          Change Layout
        </Button>
        <BlockLayoutModal 
          isOpen={isLayoutModalOpen}
          onClose={() => setIsLayoutModalOpen(false)}
          onSelect={handleLayoutChange}
        />
      </div>
    </div>
  );
};

// Helper function to preserve content when changing block types
const preserveContentDuringTypeChange = (block: ContentBlock, newType: BlockType): Partial<ContentBlock> => {
  const preserved: Partial<ContentBlock> = {};
  
  switch (newType) {
    case 'header':
      preserved.title = block.title || block.content || 'Header Title';
      preserved.content = block.content || '';
      break;
      
    case 'newsletter-header':
      preserved.title = block.title || block.content || 'Newsletter Title';
      preserved.subtitle = block.subtitle || '';
      preserved.issueNumber = block.issueNumber || '';
      preserved.publishDate = block.publishDate || '';
      preserved.backgroundImageUrl = block.backgroundImageUrl || '';
      preserved.textAlign = block.textAlign || 'center';
      preserved.padding = block.padding || 'large';
      break;
      
    case 'text':
      preserved.title = block.title || '';
      preserved.content = block.content || block.title || 'Add your text content here...';
      break;
      
    case 'image':
      preserved.title = block.title || '';
      preserved.content = block.content || '';
      preserved.imageUrl = block.imageUrl || '';
      preserved.altText = block.altText || '';
      preserved.ctaText = block.ctaText || 'Learn More';
      preserved.ctaUrl = block.ctaUrl || '#';
      break;
      
    case 'button':
      preserved.ctaText = block.ctaText || block.title || block.content || 'Click Here';
      preserved.ctaUrl = block.ctaUrl || '#';
      preserved.content = block.content || '';
      break;
      
    case 'divider':
      // Dividers typically don't have content, just styling
      preserved.content = '';
      break;
      
    case 'product':
      preserved.title = block.title || 'Product Name';
      preserved.content = block.content || 'Product description...';
      preserved.imageUrl = block.imageUrl || '';
      preserved.ctaText = block.ctaText || 'View Product';
      preserved.ctaUrl = block.ctaUrl || '#';
      break;
  }
  
  return preserved;
};

// Helper function to preserve content when changing layouts
const preserveContentDuringLayoutChange = (
  block: ContentBlock, 
  newType: BlockType, 
  newLayout: BlockLayout
): Partial<ContentBlock> => {
  // Keep all existing content but ensure it's compatible with new type
  const preserved = preserveContentDuringTypeChange(block, newType);
  
  // Preserve ALL content fields during layout changes
  return {
    ...preserved,
    // Always preserve these core content fields
    title: block.title || preserved.title,
    content: block.content || preserved.content,
    imageUrl: block.imageUrl || preserved.imageUrl,
    altText: block.altText || preserved.altText,
    ctaText: block.ctaText || preserved.ctaText,
    ctaUrl: block.ctaUrl || preserved.ctaUrl,
    // Layout-specific settings
    alignment: block.alignment || 'left',
    padding: block.padding || 'medium',
    margin: block.margin || 'medium',
    responsiveBehavior: newLayout === 'full-width' ? 'stack' : block.responsiveBehavior || 'stack'
  };
};
