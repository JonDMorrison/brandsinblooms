import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Input } from '@/components/ui-legacy/input';
import { Textarea } from '@/components/ui-legacy/textarea';
import { Label } from '@/components/ui-legacy/label';
import { NativeSelect } from '@/components/ui-legacy/NativeSelect';
import { Button } from '@/components/ui-legacy/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui-legacy/collapsible';
import { Eye, ChevronDown, Settings } from 'lucide-react';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { normalizeDateInputValue } from '@/utils/dateInputValue';

interface EmailSafeHeroBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const EmailSafeHeroBlockEditor: React.FC<EmailSafeHeroBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateField = (field: string, value: any) => {
    if (field === 'imageUrl') {
      onUpdate({ 
        [field]: value,
        autoImageMode: false,
        shouldFetchImage: false,
        isGeneratingImage: false
      });
    } else {
      onUpdate({ [field]: value });
    }
  };

  if (!isExpanded) {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 bg-gradient-to-r from-emerald-500/20 to-emerald-500/40 rounded flex items-center justify-center text-xs font-medium">
          ★
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">
            {block.headline || 'Email Safe Hero'}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {block.subtitle ? `${block.subtitle.substring(0, 50)}...` : 'Recommended for email'}
          </div>
        </div>
        {block.imageUrl && (
          <img 
            src={block.imageUrl} 
            alt="Hero" 
            className="w-6 h-6 rounded object-cover"
          />
        )}
      </div>
    );
  }

  const alignment = block.alignment || 'center';
  const backgroundColor = block.backgroundColor || '#ffffff';
  const textColor = block.textColor || '#000000';

  return (
    <div className="space-y-6">
      {/* Live Preview - Text on Solid, Image Below */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4" />
            Preview (Email Safe)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-lg">
          {/* Text Section - Solid Background */}
          <div 
            className="p-8"
            style={{
              backgroundColor,
              textAlign: alignment as any,
            }}
          >
            {block.eyebrow && (
              <p className="text-xs uppercase tracking-wider mb-2 opacity-60" style={{ color: textColor }}>
                {block.eyebrow}
              </p>
            )}
            {block.headline && (
              <h1 className="text-2xl md:text-3xl font-semibold mb-2" style={{ color: textColor }}>
                {block.headline}
              </h1>
            )}
            {block.subtitle && (
              <p className="text-sm md:text-base opacity-80 mb-2" style={{ color: textColor }}>
                {block.subtitle}
              </p>
            )}
            {block.publishDate && (
              <p className="text-xs opacity-60 mb-4" style={{ color: textColor }}>
                {new Date(block.publishDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            )}
            {block.ctaText && block.ctaUrl && (
              <div className="mt-4">
                <a 
                  href={block.ctaUrl}
                  className="inline-block px-5 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {block.ctaText}
                </a>
              </div>
            )}
          </div>
          
          {/* Image Section - Below Text */}
          {block.imageUrl && (
            <div className="bg-transparent px-4 pb-4">
              <div className="max-w-[640px] mx-auto">
                <img
                  src={block.imageUrl}
                  alt={block.altText || block.headline || ''}
                  className="w-full rounded-lg"
                  style={{ display: 'block' }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Essential Fields */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="eyebrow">Eyebrow Text (optional)</Label>
          <Input
            id="eyebrow"
            value={block.eyebrow || ''}
            onChange={(e) => updateField('eyebrow', e.target.value)}
            placeholder="e.g., Feature Article, This Week..."
          />
        </div>

        <div>
          <Label htmlFor="headline">Headline *</Label>
          <Input
            id="headline"
            value={block.headline || ''}
            onChange={(e) => updateField('headline', e.target.value)}
            placeholder="Your main headline..."
          />
        </div>

        <div>
          <Label htmlFor="subtitle">Subtitle (optional)</Label>
          <Textarea
            id="subtitle"
            value={block.subtitle || ''}
            onChange={(e) => updateField('subtitle', e.target.value)}
            placeholder="Supporting text..."
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="publishDate">Date (optional)</Label>
          <Input
            id="publishDate"
            type="date"
            value={normalizeDateInputValue(block.publishDate)}
            onChange={(e) => updateField('publishDate', e.target.value)}
          />
        </div>

        <div>
          <Label>Hero Image</Label>
          <MediaSelectorImage
            src={block.imageUrl}
            onChange={(imageUrl, metadata) => {
              updateField('imageUrl', imageUrl);
            }}
            contentContext="hero image"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="altText">Image Alt Text</Label>
          <Input
            id="altText"
            value={block.altText || ''}
            onChange={(e) => updateField('altText', e.target.value)}
            placeholder="Describe the image..."
          />
        </div>
      </div>

      {/* CTA Fields */}
      <div className="space-y-4 pt-2 border-t">
        <div className="text-sm font-medium">Call to Action (optional)</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ctaText">Button Text</Label>
            <Input
              id="ctaText"
              value={block.ctaText || ''}
              onChange={(e) => updateField('ctaText', e.target.value)}
              placeholder="Read More"
            />
          </div>
          <div>
            <Label htmlFor="ctaUrl">Button URL</Label>
            <Input
              id="ctaUrl"
              value={block.ctaUrl || ''}
              onChange={(e) => updateField('ctaUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
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
            <Label htmlFor="alignment">Text Alignment</Label>
            <NativeSelect
              value={block.alignment || 'center'}
              onChange={(e) => updateField('alignment', e.target.value)}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
              ]}
            />
          </div>

          <div>
            <Label htmlFor="backgroundColor">Background Color</Label>
            <Input
              id="backgroundColor"
              type="color"
              value={block.backgroundColor || '#ffffff'}
              onChange={(e) => updateField('backgroundColor', e.target.value)}
              className="h-10 w-full"
            />
          </div>

          <div>
            <Label htmlFor="textColor">Text Color</Label>
            <Input
              id="textColor"
              type="color"
              value={block.textColor || '#000000'}
              onChange={(e) => updateField('textColor', e.target.value)}
              className="h-10 w-full"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
