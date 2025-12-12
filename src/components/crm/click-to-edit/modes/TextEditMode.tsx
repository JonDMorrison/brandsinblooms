import React, { useState, useEffect, useMemo } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputWithMergeTags } from '@/components/ui/input-with-merge-tags';
import { Input } from '@/components/ui/input';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { cn } from '@/lib/utils';

interface TextEditModeProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onSave?: () => void;
  onCancel?: () => void;
}

export const TextEditMode: React.FC<TextEditModeProps> = ({
  block,
  onUpdate,
  onSave,
  onCancel
}) => {
  const { companyInfo } = useCompanyInfo();
  
  // Brand color swatches
  const brandColorSwatches = useMemo(() => [
    { label: 'Primary', value: companyInfo?.brandPrimaryColor || '#22c55e' },
    { label: 'Secondary', value: companyInfo?.brandSecondaryColor || '#1e40af' },
    { label: 'Accent', value: companyInfo?.brandAccentColor || '#f59e0b' },
    { label: 'Text', value: companyInfo?.brandTextColor || '#1f2937' },
    { label: 'White', value: '#ffffff' },
    { label: 'Black', value: '#000000' },
  ], [companyInfo?.brandPrimaryColor, companyInfo?.brandSecondaryColor, companyInfo?.brandAccentColor, companyInfo?.brandTextColor]);

  // Local state for input fields to preserve cursor position
  const [headline, setHeadline] = useState(block.headline || block.title || '');
  const [subheading, setSubheading] = useState(block.subtitle || '');
  const [bodyContent, setBodyContent] = useState(block.body || block.content || '');
  const [altText, setAltText] = useState(block.altText || '');
  const [ctaText, setCtaText] = useState(block.ctaText || block.buttonText || '');
  const [ctaUrl, setCtaUrl] = useState(block.ctaUrl || block.buttonUrl || '');
  const [publishDate, setPublishDate] = useState(block.publishDate || '');
  const [backgroundColor, setBackgroundColor] = useState(block.backgroundColor || '#2d5a27');
  const [textColor, setTextColor] = useState(block.textColor || '#ffffff');

  // Sync local state when block changes externally
  useEffect(() => {
    setHeadline(block.headline || block.title || '');
    setSubheading(block.subtitle || '');
    setBodyContent(block.body || block.content || '');
    setAltText(block.altText || '');
    setCtaText(block.ctaText || block.buttonText || '');
    setCtaUrl(block.ctaUrl || block.buttonUrl || '');
    setPublishDate(block.publishDate || '');
    setBackgroundColor(block.backgroundColor || '#2d5a27');
    setTextColor(block.textColor || '#ffffff');
  }, [block.id]); // Only sync when block ID changes, not on every update

  const handleSave = () => {
    // Ensure all local state is synced to parent before saving
    const updates: Partial<ContentBlock> = {
      headline,
      title: headline,
      subtitle: subheading,
      altText,
      ctaText,
      buttonText: ctaText,
      ctaUrl,
      buttonUrl: ctaUrl,
      // Always include this field if it exists
      publishDate,
      backgroundColor,
      textColor
    };

    // Add body/content field
    if (block.body !== undefined) {
      updates.body = bodyContent;
    } else if (block.content !== undefined) {
      updates.content = bodyContent;
    }

    console.log('📝 TextEditMode: Save & Close clicked - saving all fields:', {
      subtitle: subheading,
      publishDate,
      allUpdates: updates
    });
    
    // Sync all updates before calling onSave
    onUpdate(updates);
    
    // Small delay to ensure state updates are processed
    setTimeout(() => {
      onSave?.();
    }, 50);
  };

  return (
    <Card className="p-4 space-y-4 shadow-lg border-2 border-primary/20">
      <div className="text-sm font-medium text-center mb-3">
        Edit Text Content
      </div>

      {/* Color Controls for email-safe-hero blocks */}
      {block.type === 'email-safe-hero' && (
        <div className="space-y-3 p-3 bg-muted/50 rounded-lg mb-2">
          {/* Background Color */}
          <div className="grid grid-cols-[60px_40px_1fr] items-center gap-3">
            <Label className="text-xs">Background</Label>
            <Input
              type="color"
              value={backgroundColor}
              onChange={(e) => {
                setBackgroundColor(e.target.value);
                onUpdate({ backgroundColor: e.target.value });
              }}
              className="w-8 h-8 p-0.5 cursor-pointer rounded border"
            />
            <div className="flex gap-1.5 justify-end">
              {brandColorSwatches.map(swatch => (
                <button
                  key={`bg-${swatch.value}`}
                  onClick={() => {
                    setBackgroundColor(swatch.value);
                    onUpdate({ backgroundColor: swatch.value });
                  }}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    backgroundColor?.toLowerCase() === swatch.value.toLowerCase()
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-gray-300 hover:border-gray-400"
                  )}
                  style={{ backgroundColor: swatch.value }}
                  title={swatch.label}
                  type="button"
                />
              ))}
            </div>
          </div>
          
          {/* Text Color */}
          <div className="grid grid-cols-[60px_40px_1fr] items-center gap-3">
            <Label className="text-xs">Text</Label>
            <Input
              type="color"
              value={textColor}
              onChange={(e) => {
                setTextColor(e.target.value);
                onUpdate({ textColor: e.target.value });
              }}
              className="w-8 h-8 p-0.5 cursor-pointer rounded border"
            />
            <div className="flex gap-1.5 justify-end">
              {brandColorSwatches.map(swatch => (
                <button
                  key={`text-${swatch.value}`}
                  onClick={() => {
                    setTextColor(swatch.value);
                    onUpdate({ textColor: swatch.value });
                  }}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    textColor?.toLowerCase() === swatch.value.toLowerCase()
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-gray-300 hover:border-gray-400"
                  )}
                  style={{ backgroundColor: swatch.value }}
                  title={swatch.label}
                  type="button"
                />
              ))}
            </div>
          </div>
          
          {/* Alignment */}
          <div className="grid grid-cols-[60px_1fr] items-center gap-3">
            <Label className="text-xs">Align</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={block.textAlign === 'left' ? 'default' : 'ghost'}
                onClick={() => onUpdate({ textAlign: 'left' })}
                className="h-7 w-7 p-0"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={block.textAlign === 'center' || !block.textAlign ? 'default' : 'ghost'}
                onClick={() => onUpdate({ textAlign: 'center' })}
                className="h-7 w-7 p-0"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={block.textAlign === 'right' ? 'default' : 'ghost'}
                onClick={() => onUpdate({ textAlign: 'right' })}
                className="h-7 w-7 p-0"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Headline (for blocks that support it) */}
      {(block.type === 'header' || block.type === 'email-safe-hero' || block.headline !== undefined || block.title !== undefined) && (
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <InputWithMergeTags
            id="headline"
            value={headline}
            onChange={(value) => {
              setHeadline(value);
              onUpdate({ 
                headline: value,
                title: value 
              });
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === ' ') {
                e.stopPropagation();
              }
            }}
            placeholder="Enter headline"
            className="w-full"
            excludeCategories={['system']}
          />
        </div>
      )}

      {/* Subheading (for blocks that support it) */}
      {(block.type === 'header' || block.type === 'newsletter-header' || block.subtitle !== undefined) && (
        <div className="space-y-2">
          <Label htmlFor="subheading">Subheading</Label>
          <InputWithMergeTags
            id="subheading"
            value={subheading}
            onChange={(value) => {
              setSubheading(value);
              onUpdate({ subtitle: value });
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === ' ') {
                e.stopPropagation();
              }
            }}
            placeholder="Enter subheading"
            className="w-full"
            excludeCategories={['system']}
          />
        </div>
      )}

      {/* Newsletter Meta Information (for newsletter-header blocks) */}
      {block.type === 'newsletter-header' && (
        <div className="space-y-2">
          <Label htmlFor="publishDate">Publish Date</Label>
          <Input
            id="publishDate"
            type="date"
            value={publishDate}
            onChange={(e) => {
              setPublishDate(e.target.value);
              onUpdate({ publishDate: e.target.value });
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            className="w-full"
          />
        </div>
      )}

      {/* Body Text (for blocks that support it) */}
      {(block.body !== undefined || block.content !== undefined) && (
        <div className="space-y-2">
          <Label htmlFor="bodyText">
            {block.body !== undefined ? 'Body Text' : 'Content'}
          </Label>
          <RichTextEditor
            content={bodyContent}
            onChange={(html) => {
              setBodyContent(html);
              // Still update immediately for live preview
              if (block.body !== undefined) {
                onUpdate({ body: html });
              } else {
                onUpdate({ content: html });
              }
            }}
            placeholder={block.body !== undefined ? "Enter body text..." : "Enter content..."}
            className="w-full"
            showMergeTags={true}
            autoFocus
          />
        </div>
      )}

      {/* Alt Text (for blocks with images) */}
      {block.imageUrl && (
        <div className="space-y-2">
          <Label htmlFor="altText">Image Alt Text</Label>
          <Input
            id="altText"
            value={altText}
            onChange={(e) => {
              setAltText(e.target.value);
              onUpdate({ altText: e.target.value });
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === ' ') {
                e.stopPropagation();
              }
            }}
            placeholder="Describe the image for accessibility"
          />
        </div>
      )}

      {/* CTA Text and URL (for blocks that support it) */}
      {(block.ctaText !== undefined || block.ctaUrl !== undefined || block.buttonText !== undefined || block.buttonUrl !== undefined || block.type === 'image' || block.type === 'image-text' || block.type === 'text') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ctaText">Button Text</Label>
            <Input
              id="ctaText"
              value={ctaText}
              onChange={(e) => {
                setCtaText(e.target.value);
                onUpdate({ 
                  ctaText: e.target.value,
                  buttonText: e.target.value 
                });
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === ' ') {
                  e.stopPropagation();
                }
              }}
              placeholder="Enter button text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctaUrl">Button URL</Label>
            <Input
              id="ctaUrl"
              value={ctaUrl}
              onChange={(e) => {
                setCtaUrl(e.target.value);
                onUpdate({ 
                  ctaUrl: e.target.value,
                  buttonUrl: e.target.value 
                });
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === ' ') {
                  e.stopPropagation();
                }
              }}
              placeholder="https://example.com"
            />
          </div>
        </div>
      )}

      {/* Save/Cancel Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onCancel}
          className="px-4"
        >
          Cancel
        </Button>
        <Button 
          variant="default" 
          size="sm"
          onClick={handleSave}
          className="px-4"
        >
          Save & Close
        </Button>
      </div>
    </Card>
  );
};