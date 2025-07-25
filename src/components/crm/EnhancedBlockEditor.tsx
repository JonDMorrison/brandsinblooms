import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  GripVertical,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockTypeConverter } from './BlockTypeConverter';
import { HeaderBlockEditor } from './blocks/HeaderBlockEditor';
import { NewsletterHeaderBlockEditor } from './blocks/NewsletterHeaderBlockEditor';
import { QuoteBlockEditor } from './blocks/QuoteBlockEditor';
import { CTABlockEditor } from './blocks/CTABlockEditor';
import { ImageBlockEditor } from './blocks/ImageBlockEditor';
import { ButtonBlockEditor } from './blocks/ButtonBlockEditor';
import { TextBlockEditor } from './blocks/TextBlockEditor';
import { DividerBlockEditor } from './blocks/DividerBlockEditor';
import { ProductBlockEditor } from './blocks/ProductBlockEditor';

interface EnhancedBlockEditorProps {
  block: ContentBlock;
  index: number;
  onUpdate: (id: string, updates: Partial<ContentBlock>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (block: ContentBlock) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export const EnhancedBlockEditor: React.FC<EnhancedBlockEditorProps> = ({
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

  const renderSpecializedEditor = () => {
    switch (block.type) {
      case 'header':
        return (
          <HeaderBlockEditor 
            block={block} 
            onUpdate={handleUpdate} 
            isExpanded={isExpanded}
          />
        );
      case 'text':
        return (
          <TextBlockEditor 
            block={block} 
            onUpdate={handleUpdate} 
            isExpanded={isExpanded}
          />
        );
      case 'image':
        return (
          <ImageBlockEditor 
            block={block} 
            onUpdate={handleUpdate} 
            isExpanded={isExpanded}
          />
        );
      case 'button':
        return (
          <ButtonBlockEditor 
            block={block} 
            onUpdate={handleUpdate} 
            isExpanded={isExpanded}
          />
        );
      case 'divider':
        return (
          <DividerBlockEditor 
            block={block} 
            onUpdate={handleUpdate} 
            isExpanded={isExpanded}
          />
        );
      case 'product':
        return (
          <ProductBlockEditor 
            block={block} 
            onUpdate={handleUpdate} 
            isExpanded={isExpanded}
          />
        );
      default:
        // Fallback for any unknown block types
        return (
          <div className="p-4 text-center text-muted-foreground">
            <Settings className="h-8 w-8 mx-auto mb-2" />
            <p>Editor for {block.type} blocks coming soon...</p>
          </div>
        );
    }
  };

  return (
    <Card className={cn(
      "transition-all duration-200",
      isExpanded ? "shadow-md" : "shadow-sm",
      block.visible === false && "opacity-60"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Block Info */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{getBlockIcon()}</span>
            <Badge variant="outline" className="text-xs">
              {getBlockTypeLabel()}
            </Badge>
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
          </div>

          {/* Block Content Preview */}
          <div className="flex-1 min-w-0">
            {renderSpecializedEditor()}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Move Buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(block.id, 'up')}
              disabled={!canMoveUp}
              className="h-8 w-8 p-0"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(block.id, 'down')}
              disabled={!canMoveDown}
              className="h-8 w-8 p-0"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>

            {/* Duplicate Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDuplicate(block)}
              className="h-8 w-8 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>

            {/* Delete Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(block.id)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>

            {/* Expand/Collapse Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Block Type Converter */}
          <BlockTypeConverter block={block} onUpdate={handleUpdate} />
          
          {/* Specialized Editor Content */}
          <div className="border-t pt-4">
            {renderSpecializedEditor()}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
