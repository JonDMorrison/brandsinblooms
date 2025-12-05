import React from 'react';
import { ContentBlock, NewsletterHeaderBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { Calendar } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { HeaderImageLoadingOverlay } from './HeaderImageLoadingOverlay';

interface NewsletterHeaderBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
  isGeneratingHeaderImage?: boolean;
  headerImageStage?: 'waiting' | 'aggregating' | 'fetching' | 'complete' | 'error';
}

export const NewsletterHeaderBlockEditor: React.FC<NewsletterHeaderBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded,
  isGeneratingHeaderImage = false,
  headerImageStage = 'waiting'
}) => {
  // Get values from either top-level or content object
  // Content can be string or object, so we need to handle both
  const contentObj = typeof block.content === 'object' ? block.content : {};
  // Map both 'title' and 'headline' for backwards compatibility
  const title = (block as any).title || (contentObj as any)?.title || (contentObj as any)?.headline || '';
  const subtitle = (block as any).subtitle || (contentObj as any)?.subtitle || '';
  const publishDate = (block as any).publishDate || (contentObj as any)?.publishDate || '';
  const backgroundImageUrl = (block as any).backgroundImageUrl || (contentObj as any)?.backgroundImageUrl || '';
  const backgroundOpacity = (block as any).backgroundOpacity ?? (contentObj as any)?.backgroundOpacity ?? 0.25;

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    // DETERMINISTIC IMAGE BEHAVIOR: When user manually selects a background image,
    // set autoImageMode = false to prevent system from ever auto-replacing it
    onUpdate({ 
      backgroundImageUrl: imageUrl,
      altText: metadata?.alt || 'Newsletter header background',
      autoImageMode: false,
      shouldFetchImage: false,
      isGeneratingImage: false
    } as any);
  };

  if (!isExpanded) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground truncate">
          {title ? `Header: "${title}"` : 'Newsletter Header'}
          {subtitle && (
            <span className="ml-2 text-xs">
              - {subtitle.substring(0, 30)}...
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Loading Overlay for Header Image Generation */}
      {isGeneratingHeaderImage && (
        <HeaderImageLoadingOverlay stage={headerImageStage} />
      )}

      {/* Header Preview */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent relative overflow-hidden">
        {backgroundImageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${backgroundImageUrl})`,
              opacity: backgroundOpacity 
            }}
          />
        )}
        <div className="relative text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {title || 'Newsletter Title'}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground">
              {subtitle}
            </p>
          )}
          {publishDate && (
            <div className="flex justify-center text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {publishDate}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Header Content */}
      <div>
        <Label htmlFor="header-title">Newsletter Title</Label>
        <Input
          id="header-title"
          value={title}
          onChange={(e) => onUpdate({ 
            title: e.target.value,
            headline: e.target.value // Also update headline for backwards compatibility
          })}
          placeholder="Enter newsletter title..."
        />
      </div>

      <div>
        <Label htmlFor="header-subtitle">Subtitle (Optional)</Label>
        <Textarea
          id="header-subtitle"
          value={subtitle}
          onChange={(e) => onUpdate({ subtitle: e.target.value })}
          placeholder="Enter subtitle or description..."
          className="min-h-[80px]"
        />
      </div>

      {/* Newsletter Meta Information */}
      <div>
        <Label htmlFor="publish-date">Publish Date</Label>
        <Input
          id="publish-date"
          type="date"
          value={publishDate}
          onChange={(e) => onUpdate({ publishDate: e.target.value })}
        />
      </div>

      {/* Background Image */}
      <div>
        <Label>Background Image (Optional)</Label>
        <div className="mt-2">
          <MediaSelectorImage
            src={backgroundImageUrl}
            onChange={handleImageSelect}
            contentContext={`${title || ''} newsletter header background`}
            className="h-32"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          This image will appear behind the header text with adjustable opacity
        </p>
      </div>

      {/* Background Opacity Slider */}
      {backgroundImageUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="bg-opacity">Background Opacity</Label>
            <span className="text-sm text-muted-foreground font-medium">
              {Math.round(backgroundOpacity * 100)}%
            </span>
          </div>
          <Slider
            id="bg-opacity"
            value={[backgroundOpacity * 100]}
            onValueChange={([value]) => onUpdate({ 
              backgroundOpacity: value / 100 
            })}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Adjust the transparency of the background image
          </p>
        </div>
      )}
    </div>
  );
};