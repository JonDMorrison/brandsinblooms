import React from 'react';
import { ContentBlock, CTABlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SafeHtml } from '@/components/ui/safe-html';
import { ExternalLink } from 'lucide-react';

interface CTABlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const CTABlockEditor: React.FC<CTABlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  if (!isExpanded) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground truncate">
          {block.ctaText ? `CTA: "${block.ctaText}"` : 'CTA Block'}
          {block.heading && (
            <span className="ml-2 text-xs">
              - {block.heading.substring(0, 30)}...
            </span>
          )}
        </div>
      </div>
    );
  }

  const getButtonVariant = (style: string) => {
    switch (style) {
      case 'secondary': return 'secondary';
      case 'outline': return 'outline';
      case 'ghost': return 'ghost';
      default: return 'default';
    }
  };

  const getButtonSize = (size: string) => {
    switch (size) {
      case 'small': return 'sm';
      case 'large': return 'lg';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-4">
      {/* CTA Preview */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className={`text-${block.alignment || 'center'} space-y-4`}>
          {block.heading && (
            <h3 className="text-lg font-semibold text-foreground">
              {block.heading}
            </h3>
          )}
          {block.body && (
            <p className="text-muted-foreground">
              <SafeHtml content={block.body || ''} type="general" className="text-center text-muted-foreground mb-6" />
            </p>
          )}
          <div>
            <Button 
              variant={getButtonVariant(block.ctaStyle || 'primary')}
              size={getButtonSize(block.ctaSize || 'medium')}
              className="group"
            >
              {block.ctaText || 'Call to Action'}
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Content Fields */}
      <div>
        <Label htmlFor="cta-heading">Heading (Optional)</Label>
        <Input
          id="cta-heading"
          value={block.heading || ''}
          onChange={(e) => onUpdate({ heading: e.target.value })}
          placeholder="Enter headline..."
        />
      </div>

      <div>
        <Label htmlFor="cta-body">Description (Optional)</Label>
        <Textarea
          id="cta-body"
          value={block.body || ''}
          onChange={(e) => onUpdate({ body: e.target.value })}
          placeholder="Enter description text..."
          className="min-h-[80px]"
        />
      </div>

      {/* CTA Button Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cta-text">Button Text</Label>
          <Input
            id="cta-text"
            value={block.ctaText || ''}
            onChange={(e) => onUpdate({ ctaText: e.target.value })}
            placeholder="Call to action text..."
          />
        </div>
        <div>
          <Label htmlFor="cta-url">Button URL</Label>
          <Input
            id="cta-url"
            value={block.ctaUrl || ''}
            onChange={(e) => onUpdate({ ctaUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>

      {/* Button Styling */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="cta-style">Button Style</Label>
          <NativeSelect
            value={block.ctaStyle || 'primary'}
            onChange={(e) => onUpdate({ ctaStyle: e.target.value as any })}
            options={[
              { value: 'primary', label: 'Primary' },
              { value: 'secondary', label: 'Secondary' },
              { value: 'outline', label: 'Outline' },
              { value: 'ghost', label: 'Ghost' }
            ]}
          />
        </div>

        <div>
          <Label htmlFor="cta-size">Button Size</Label>
          <NativeSelect
            value={block.ctaSize || 'medium'}
            onChange={(e) => onUpdate({ ctaSize: e.target.value as any })}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' }
            ]}
          />
        </div>

        <div>
          <Label htmlFor="cta-alignment">Alignment</Label>
          <NativeSelect
            value={block.alignment || 'center'}
            onChange={(e) => onUpdate({ alignment: e.target.value as any })}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' }
            ]}
          />
        </div>
      </div>

      {/* Spacing */}
      <div>
        <Label htmlFor="cta-padding">Padding</Label>
        <NativeSelect
          value={block.padding || 'medium'}
          onChange={(e) => onUpdate({ padding: e.target.value as any })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
            { value: 'extra-large', label: 'Extra Large' }
          ]}
        />
      </div>
    </div>
  );
};