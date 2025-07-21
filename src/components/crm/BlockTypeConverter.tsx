import React from 'react';
import { ContentBlock, BlockType, BlockLayout } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlockLayoutModal, LayoutType } from './BlockLayoutModal';
import { mapModalLayoutToBlockLayout, determineBlockTypeFromLayout } from './LayoutRenderer';
import { RefreshCw, Layout } from 'lucide-react';

interface BlockTypeConverterProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
}

const blockTypeOptions = [
  { value: 'header', label: 'Header', icon: '📄' },
  { value: 'text', label: 'Text', icon: '📝' },
  { value: 'image', label: 'Image', icon: '🖼️' },
  { value: 'button', label: 'Button', icon: '🔘' }
];

export const BlockTypeConverter: React.FC<BlockTypeConverterProps> = ({
  block,
  onUpdate
}) => {
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
    
    // Preserve content during layout change
    const preservedContent = preserveContentDuringLayoutChange(block, newBlockType, newBlockLayout);
    
    onUpdate({
      type: newBlockType,
      layout: newBlockLayout,
      ...preservedContent
    });
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Convert to:</span>
        <Select value={block.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {blockTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2">
        <Layout className="h-4 w-4 text-muted-foreground" />
        <BlockLayoutModal 
          onSelect={handleLayoutChange}
          triggerText="Change Layout"
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
      
    case 'text':
      preserved.title = block.title || '';
      preserved.content = block.content || block.title || 'Add your text content here...';
      break;
      
    case 'image':
      preserved.imageUrl = block.imageUrl || '';
      preserved.title = block.title || '';
      preserved.content = block.content || '';
      break;
      
    case 'button':
      preserved.ctaText = block.ctaText || block.title || block.content || 'Click Here';
      preserved.ctaUrl = block.ctaUrl || '#';
      preserved.content = block.content || '';
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
  
  // Preserve layout-specific settings
  return {
    ...preserved,
    alignment: block.alignment || 'left',
    padding: block.padding || 'medium',
    margin: block.margin || 'medium',
    responsiveBehavior: newLayout === 'full-width' ? 'stack' : block.responsiveBehavior || 'stack'
  };
};
