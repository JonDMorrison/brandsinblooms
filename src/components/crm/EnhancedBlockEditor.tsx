
import React, { useState } from 'react';
import { ContentBlock, AlignmentType, SpacingType, ResponsiveBehaviorType } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageSelectButton } from '@/components/image/ImageSelectButton';
import { 
  GripVertical, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Smartphone,
  Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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

  const handleToggleCollapse = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onUpdate(block.id, { collapsed: !newExpanded });
  };

  const updateField = (field: keyof ContentBlock, value: any) => {
    onUpdate(block.id, { [field]: value });
  };

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    onUpdate(block.id, { 
      imageUrl,
      ...(metadata?.alt_text && { title: metadata.alt_text })
    });
  };

  const getBlockTypeIcon = () => {
    const icons = {
      header: '📄',
      text: '📝',
      image: '🖼️',
      button: '🔘',
      divider: '➖',
      product: '🛍️'
    };
    return icons[block.type] || '📄';
  };

  const getPreviewText = () => {
    if (block.title) return block.title;
    if (block.content) return block.content.substring(0, 50) + (block.content.length > 50 ? '...' : '');
    if (block.ctaText) return block.ctaText;
    return `${block.type} block`;
  };

  const spacingOptions: { value: SpacingType; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' }
  ];

  const responsiveBehaviorOptions: { value: ResponsiveBehaviorType; label: string }[] = [
    { value: 'stack', label: 'Stack normally' },
    { value: 'reverse', label: 'Reverse order' },
    { value: 'hide-image', label: 'Hide images' }
  ];

  return (
    <div className="border border-border rounded-lg bg-card shadow-sm">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div 
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleToggleCollapse}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-lg flex-shrink-0">{getBlockTypeIcon()}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">
                  Block {index + 1}: {block.type}
                </span>
                <div className="text-xs text-muted-foreground truncate">
                  {getPreviewText()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(block.id, 'up');
                }}
                disabled={!canMoveUp}
                className="h-8 w-8 p-0"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(block.id, 'down');
                }}
                disabled={!canMoveDown}
                className="h-8 w-8 p-0"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(block);
                }}
                className="h-8 w-8 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(block.id);
                }}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4 border-t border-border">
            {/* Layout Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Alignment */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Alignment</Label>
                <div className="flex border border-border rounded-md">
                  {[
                    { value: 'left' as AlignmentType, icon: AlignLeft },
                    { value: 'center' as AlignmentType, icon: AlignCenter },
                    { value: 'right' as AlignmentType, icon: AlignRight }
                  ].map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => updateField('alignment', value)}
                      className={cn(
                        'flex-1 p-2 flex items-center justify-center transition-colors',
                        block.alignment === value 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Padding */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Padding</Label>
                <select
                  value={block.padding || 'medium'}
                  onChange={(e) => updateField('padding', e.target.value as SpacingType)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                >
                  {spacingOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Margin */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Margin</Label>
                <select
                  value={block.margin || 'medium'}
                  onChange={(e) => updateField('margin', e.target.value as SpacingType)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                >
                  {spacingOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Responsive Behavior */}
            {block.layout !== 'full-width' && (
              <div>
                <Label className="text-xs font-medium mb-2 flex items-center gap-2">
                  <Smartphone className="h-3 w-3" />
                  Mobile Behavior
                </Label>
                <select
                  value={block.responsiveBehavior || 'stack'}
                  onChange={(e) => updateField('responsiveBehavior', e.target.value as ResponsiveBehaviorType)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                >
                  {responsiveBehaviorOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Content Fields */}
            <div className="space-y-3">
              {/* Title */}
              <div>
                <Label className="text-xs font-medium mb-1 block">Title</Label>
                <Input
                  value={block.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder={`Enter ${block.type} title...`}
                  className="text-sm"
                />
              </div>

              {/* Content */}
              {block.type !== 'button' && block.type !== 'image' && (
                <div>
                  <Label className="text-xs font-medium mb-1 block">Content</Label>
                  <Textarea
                    value={block.content || ''}
                    onChange={(e) => updateField('content', e.target.value)}
                    placeholder="Enter content..."
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>
              )}

              {/* Image Selection */}
              {block.type === 'image' && (
                <div>
                  <Label className="text-xs font-medium mb-1 block">Image</Label>
                  <ImageSelectButton
                    onImageSelect={handleImageSelect}
                    selectedImageUrl={block.imageUrl}
                    contentContext={block.title || block.content}
                    mode="modal"
                    buttonText="Select Image"
                    className="w-full text-sm"
                  />
                </div>
              )}

              {/* Button Fields */}
              {block.type === 'button' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Button Text</Label>
                    <Input
                      value={block.ctaText || ''}
                      onChange={(e) => updateField('ctaText', e.target.value)}
                      placeholder="Click Here"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Button URL</Label>
                    <Input
                      value={block.ctaUrl || ''}
                      onChange={(e) => updateField('ctaUrl', e.target.value)}
                      placeholder="https://example.com"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              {/* CTA Fields for other blocks */}
              {block.type !== 'button' && block.type !== 'header' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium mb-1 block">CTA Text (Optional)</Label>
                    <Input
                      value={block.ctaText || ''}
                      onChange={(e) => updateField('ctaText', e.target.value)}
                      placeholder="Learn More"
                      className="text-sm"
                    />
                  </div>
                  {block.ctaText && (
                    <div>
                      <Label className="text-xs font-medium mb-1 block">CTA URL</Label>
                      <Input
                        value={block.ctaUrl || ''}
                        onChange={(e) => updateField('ctaUrl', e.target.value)}
                        placeholder="https://example.com"
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
