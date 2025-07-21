
import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { BlockTypeConverter } from './BlockTypeConverter';
import { LayoutPreview } from './LayoutRenderer';
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Eye,
  EyeOff,
  Palette,
  Settings
} from 'lucide-react';

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
  const [collapsed, setCollapsed] = useState(block.collapsed || false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleUpdate = (updates: Partial<ContentBlock>) => {
    onUpdate(block.id, updates);
  };

  const getBlockIcon = (type: ContentBlock['type']) => {
    switch (type) {
      case 'header': return '📄';
      case 'text': return '📝';
      case 'image': return '🖼️';
      case 'button': return '🔘';
      default: return '📦';
    }
  };

  const getBlockTitle = (block: ContentBlock) => {
    if (block.title) return block.title;
    if (block.content) return block.content.substring(0, 30) + '...';
    if (block.ctaText) return block.ctaText;
    return `${block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block`;
  };

  return (
    <Card className={`transition-all duration-200 ${block.visible === false ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-lg">{getBlockIcon(block.type)}</span>
              <div>
                <h3 className="font-medium text-sm">{getBlockTitle(block)}</h3>
                <p className="text-xs text-muted-foreground">
                  {block.type} • {block.layout || 'full-width'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleUpdate({ visible: !(block.visible ?? true) })}
              title={block.visible === false ? 'Show block' : 'Hide block'}
            >
              {block.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMove(block.id, 'up')}
              disabled={!canMoveUp}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMove(block.id, 'down')}
              disabled={!canMoveDown}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDuplicate(block)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(block.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Block Type and Layout Converter */}
        {!collapsed && (
          <BlockTypeConverter
            block={block}
            onUpdate={handleUpdate}
          />
        )}
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4">
          {/* Content Fields */}
          <div className="space-y-3">
            {(block.type === 'header' || block.type === 'text' || block.type === 'image') && (
              <div>
                <Label htmlFor={`title-${block.id}`}>Title</Label>
                <Input
                  id={`title-${block.id}`}
                  value={block.title || ''}
                  onChange={(e) => handleUpdate({ title: e.target.value })}
                  placeholder="Enter title..."
                />
              </div>
            )}

            {(block.type === 'header' || block.type === 'text') && (
              <div>
                <Label htmlFor={`content-${block.id}`}>Content</Label>
                <Textarea
                  id={`content-${block.id}`}
                  value={block.content || ''}
                  onChange={(e) => handleUpdate({ content: e.target.value })}
                  placeholder="Enter content..."
                  rows={3}
                />
              </div>
            )}

            {block.type === 'image' && (
              <div>
                <Label htmlFor={`image-${block.id}`}>Image URL</Label>
                <Input
                  id={`image-${block.id}`}
                  value={block.imageUrl || ''}
                  onChange={(e) => handleUpdate({ imageUrl: e.target.value })}
                  placeholder="Enter image URL..."
                />
              </div>
            )}

            {(block.type === 'button' || block.type === 'image') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`cta-text-${block.id}`}>Button Text</Label>
                  <Input
                    id={`cta-text-${block.id}`}
                    value={block.ctaText || ''}
                    onChange={(e) => handleUpdate({ ctaText: e.target.value })}
                    placeholder="Button text..."
                  />
                </div>
                <div>
                  <Label htmlFor={`cta-url-${block.id}`}>Button URL</Label>
                  <Input
                    id={`cta-url-${block.id}`}
                    value={block.ctaUrl || ''}
                    onChange={(e) => handleUpdate({ ctaUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Layout Preview */}
          <LayoutPreview block={block} onUpdate={handleUpdate} />

          {/* Advanced Settings Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Advanced Settings
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Alignment</Label>
                    <Select
                      value={block.alignment || 'left'}
                      onValueChange={(value) => handleUpdate({ alignment: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Responsive Behavior</Label>
                    <Select
                      value={block.responsiveBehavior || 'stack'}
                      onValueChange={(value) => handleUpdate({ responsiveBehavior: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stack">Stack</SelectItem>
                        <SelectItem value="reverse">Reverse</SelectItem>
                        <SelectItem value="hide-image">Hide Image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Padding</Label>
                    <Select
                      value={block.padding || 'medium'}
                      onValueChange={(value) => handleUpdate({ padding: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Margin</Label>
                    <Select
                      value={block.margin || 'medium'}
                      onValueChange={(value) => handleUpdate({ margin: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`bg-color-${block.id}`}>Background Color</Label>
                    <Input
                      id={`bg-color-${block.id}`}
                      type="color"
                      value={block.backgroundColor || '#ffffff'}
                      onChange={(e) => handleUpdate({ backgroundColor: e.target.value })}
                      className="h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`text-color-${block.id}`}>Text Color</Label>
                    <Input
                      id={`text-color-${block.id}`}
                      type="color"
                      value={block.textColor || '#000000'}
                      onChange={(e) => handleUpdate({ textColor: e.target.value })}
                      className="h-10"
                    />
                  </div>
                </div>

                <div>
                  <Label>Animation</Label>
                  <Select
                    value={block.animation || 'fade-in'}
                    onValueChange={(value) => handleUpdate({ animation: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fade-in">Fade In</SelectItem>
                      <SelectItem value="slide-up">Slide Up</SelectItem>
                      <SelectItem value="scale-in">Scale In</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id={`visible-${block.id}`}
                    checked={block.visible ?? true}
                    onCheckedChange={(checked) => handleUpdate({ visible: checked })}
                  />
                  <Label htmlFor={`visible-${block.id}`}>Block visible</Label>
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};
