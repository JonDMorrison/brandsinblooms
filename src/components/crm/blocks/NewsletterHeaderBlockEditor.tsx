import React from 'react';
import { ContentBlock, NewsletterHeaderBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { Calendar, Hash, FileText } from 'lucide-react';

interface NewsletterHeaderBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const NewsletterHeaderBlockEditor: React.FC<NewsletterHeaderBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  // Get values from either top-level or content object
  // Content can be string or object, so we need to handle both
  const contentObj = typeof block.content === 'object' ? block.content : {};
  const title = (block as any).title || (contentObj as any)?.title || '';
  const subtitle = (block as any).subtitle || (contentObj as any)?.subtitle || '';
  const issueNumber = (block as any).issueNumber || (contentObj as any)?.issueNumber || '';
  const publishDate = (block as any).publishDate || (contentObj as any)?.publishDate || '';
  const backgroundImageUrl = (block as any).backgroundImageUrl || (contentObj as any)?.backgroundImageUrl || '';

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    onUpdate({ 
      backgroundImageUrl: imageUrl,
      altText: metadata?.alt || 'Newsletter header background'
    });
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
    <div className="space-y-4">
      {/* Header Preview */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent relative overflow-hidden">
        {backgroundImageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${backgroundImageUrl})` }}
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
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            {issueNumber && (
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                Issue {issueNumber}
              </div>
            )}
            {publishDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {publishDate}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Header Content */}
      <div>
        <Label htmlFor="header-title">Newsletter Title</Label>
        <Input
          id="header-title"
          value={title}
          onChange={(e) => onUpdate({ title: e.target.value })}
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="issue-number">Issue Number</Label>
          <Input
            id="issue-number"
            value={issueNumber}
            onChange={(e) => onUpdate({ issueNumber: e.target.value })}
            placeholder="e.g., 47"
          />
        </div>
        <div>
          <Label htmlFor="publish-date">Publish Date</Label>
          <Input
            id="publish-date"
            type="date"
            value={publishDate}
            onChange={(e) => onUpdate({ publishDate: e.target.value })}
          />
        </div>
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
          This image will appear behind the header text with reduced opacity
        </p>
      </div>
    </div>
  );
};