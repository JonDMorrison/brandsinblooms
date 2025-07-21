
import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronUp, 
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockContextMenu } from './BlockContextMenu';
import { HeaderBlockEditor } from './blocks/HeaderBlockEditor';
import { ImageBlockEditor } from './blocks/ImageBlockEditor';
import { ButtonBlockEditor } from './blocks/ButtonBlockEditor';
import { TextBlockEditor } from './blocks/TextBlockEditor';
import { DividerBlockEditor } from './blocks/DividerBlockEditor';
import { ProductBlockEditor } from './blocks/ProductBlockEditor';

interface SimpleBlockEditorProps {
  block: ContentBlock;
  index: number;
  onUpdate: (id: string, updates: Partial<ContentBlock>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (block: ContentBlock) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export const SimpleBlockEditor: React.FC<SimpleBlockEditorProps> = ({
  block,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  canMoveUp,
  canMoveDown
}) => {
  const [isExpanded, setIsExpanded] = useState(!block.collapsed);

  const handleUpdate = (updates: Partial<ContentBlock>) => {
    onUpdate(block.id, updates);
  };

  const toggleExpanded = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    handleUpdate({ collapsed: !newExpanded });
  };

  const toggleVisibility = () => {
    handleUpdate({ visible: block.visible === false ? true : false });
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case 'header': return '📄';
      case 'text': return '📝';
      case 'image': return '🖼️';
      case 'button': return '🔘';
      case 'divider': return '➖';
      case 'product': return '📦';
      default: return '📄';
    }
  };

  const getBlockTypeLabel = () => {
    return block.type.charAt(0).toUpperCase() + block.type.slice(1);
  };

  const getPreviewContent = () => {
    switch (block.type) {
      case 'header':
        return block.headline || 'Header Block';
      case 'text':
        return block.title || block.content?.substring(0, 50) || 'Text Block';
      case 'image':
        return block.altText || 'Image Block';
      case 'button':
        return block.buttonText || 'Button Block';
      case 'divider':
        return 'Divider';
      case 'product':
        return block.title || 'Product Block';
      default:
        return 'Content Block';
    }
  };

  const renderSpecializedEditor = () => {
    const props = { block, onUpdate: handleUpdate, isExpanded };
    
    switch (block.type) {
      case 'header':
        return <HeaderBlockEditor {...props} />;
      case 'text':
        return <TextBlockEditor {...props} />;
      case 'image':
        return <ImageBlockEditor {...props} />;
      case 'button':
        return <ButtonBlockEditor {...props} />;
      case 'divider':
        return <DividerBlockEditor {...props} />;
      case 'product':
        return <ProductBlockEditor {...props} />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn(
      "group transition-all duration-200 hover:shadow-md",
      isExpanded ? "shadow-sm" : "shadow-xs",
      block.visible === false && "opacity-60"
    )}>
      {/* Simplified Header */}
      <div 
        className={cn(
          "flex items-center gap-3 p-4 cursor-pointer",
          "hover:bg-muted/30 transition-colors"
        )}
        onClick={toggleExpanded}
      >
        {/* Drag Handle */}
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Block Icon & Type */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{getBlockIcon()}</span>
          <Badge variant="outline" className="text-xs font-medium">
            {getBlockTypeLabel()}
          </Badge>
        </div>

        {/* Preview Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {getPreviewContent()}
          </div>
          {block.visible === false && (
            <div className="text-xs text-muted-foreground">Hidden</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <BlockContextMenu
            block={block}
            onDuplicate={() => onDuplicate(block)}
            onDelete={() => onRemove(block.id)}
            onMoveUp={() => onMove(block.id, 'up')}
            onMoveDown={() => onMove(block.id, 'down')}
            onToggleVisibility={toggleVisibility}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />

          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t bg-muted/20 p-6">
          {renderSpecializedEditor()}
        </div>
      )}
    </Card>
  );
};
