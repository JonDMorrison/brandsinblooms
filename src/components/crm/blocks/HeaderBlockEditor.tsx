
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Upload, Eye, ChevronDown, Settings } from 'lucide-react';
import { useState } from 'react';
import { ImageSelectButton } from '@/components/image';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';

interface HeaderBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const HeaderBlockEditor: React.FC<HeaderBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateField = (field: string, value: any) => {
    console.log('[HeaderBlockEditor] updateField called:', field, value);
    console.log('[HeaderBlockEditor] Current block before update:', block);
    onUpdate({ [field]: value });
    console.log('[HeaderBlockEditor] onUpdate called with:', { [field]: value });
  };

  if (!isExpanded) {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 bg-gradient-to-r from-primary/20 to-primary/40 rounded flex items-center justify-center text-xs font-medium">
          H
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">
            {block.headline || 'Header Block'}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {block.body ? `${block.body.substring(0, 50)}...` : 'No body text'}
          </div>
        </div>
        {block.backgroundImageUrl && (
          <img 
            src={block.backgroundImageUrl} 
            alt="Background" 
            className="w-6 h-6 rounded object-cover"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            className="relative min-h-[120px] flex items-center justify-center text-white"
            style={{
              backgroundImage: block.backgroundImageUrl ? `url(${block.backgroundImageUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {block.backgroundImageUrl && (
              <div 
                className="absolute inset-0 bg-black"
                style={{ opacity: block.backgroundOpacity || 0.4 }}
              />
            )}
            <div 
              className={`relative z-10 p-6 text-${block.alignment || 'center'} w-full`}
              style={{ backgroundColor: block.backgroundImageUrl ? 'transparent' : (block.backgroundColor || '#1f2937') }}
            >
              <h1 className="text-2xl font-bold mb-2">
                {block.headline || 'Your Header Title'}
              </h1>
              {block.body && (
                <div className="text-sm opacity-90 leading-relaxed">
                  {block.body}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Essential Fields */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={block.headline || ''}
            onChange={(e) => updateField('headline', e.target.value)}
            placeholder="Enter your header title..."
          />
        </div>

        <div>
          <Label htmlFor="body">Body Text</Label>
          <Textarea
            id="body"
            value={block.body || ''}
            onChange={(e) => updateField('body', e.target.value)}
            placeholder="Add supporting text..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="alignment">Text Alignment</Label>
          <Select
            value={block.alignment || 'center'}
            onValueChange={(value) => updateField('alignment', value)}
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
      </div>

      {/* Advanced Options */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Advanced Options
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <div>
            <Label>Background Image</Label>
            <MediaSelectorImage
              src={block.backgroundImageUrl}
              onChange={(imageUrl, metadata) => {
                console.log('[HeaderBlockEditor] MediaSelectorImage onChange called:', imageUrl, metadata);
                updateField('backgroundImageUrl', imageUrl);
              }}
              contentContext="header background"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="backgroundColor">Background Color</Label>
            <Input
              id="backgroundColor"
              type="color"
              value={block.backgroundColor || '#1f2937'}
              onChange={(e) => updateField('backgroundColor', e.target.value)}
              className="h-10 w-full"
            />
          </div>

          <div>
            <Label htmlFor="opacity">Background Opacity</Label>
            <div className="px-3">
              <Slider
                value={[block.backgroundOpacity || 0.4]}
                onValueChange={(value) => updateField('backgroundOpacity', value[0])}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round((block.backgroundOpacity || 0.4) * 100)}% {block.backgroundImageUrl ? 'overlay' : 'opacity'}
            </div>
          </div>

          <div>
            <Label htmlFor="padding">Padding</Label>
            <Select
              value={block.padding || 'medium'}
              onValueChange={(value) => updateField('padding', value)}
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
