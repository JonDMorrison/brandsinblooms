import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Input } from '@/components/ui-legacy/input';
import { Label } from '@/components/ui-legacy/label';
import { Eye, ImageIcon } from 'lucide-react';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';

interface GraphicHeroBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const GraphicHeroBlockEditor: React.FC<GraphicHeroBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
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
        <div className="w-8 h-8 bg-gradient-to-r from-violet-500/20 to-violet-500/40 rounded flex items-center justify-center">
          <ImageIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">
            Graphic Hero
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {block.imageUrl ? 'Image with text baked in' : 'No image selected'}
          </div>
        </div>
        {block.imageUrl && (
          <img 
            src={block.imageUrl} 
            alt="" 
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
            Preview (Graphic Hero)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-lg">
          {block.imageUrl ? (
            <div className="max-w-[640px] mx-auto">
              <a 
                href={block.ctaUrl || '#'} 
                className="block"
                style={{ cursor: block.ctaUrl ? 'pointer' : 'default' }}
              >
                <img
                  src={block.imageUrl}
                  alt={block.altText || ''}
                  className="w-full"
                  style={{ display: 'block', border: 0, outline: 'none' }}
                />
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 bg-muted text-muted-foreground">
              <div className="text-center">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Upload a graphic with text baked in</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fields */}
      <div className="space-y-4">
        <div className="bg-muted/50 p-4 rounded-lg text-sm">
          <p className="font-medium mb-1">💡 Graphic Hero</p>
          <p className="text-muted-foreground">
            Use this block when your text is already part of the image (e.g., designed in Canva). 
            This ensures text displays correctly in all email clients.
          </p>
        </div>

        <div>
          <Label>Hero Image (with text baked in)</Label>
          <MediaSelectorImage
            src={block.imageUrl}
            onChange={(imageUrl, metadata) => {
              updateField('imageUrl', imageUrl);
            }}
            contentContext="graphic hero image"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="altText">Alt Text *</Label>
          <Input
            id="altText"
            value={block.altText || ''}
            onChange={(e) => updateField('altText', e.target.value)}
            placeholder="Describe what the image says..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            Important for accessibility - describe any text in the image
          </p>
        </div>

        <div>
          <Label htmlFor="ctaUrl">Click-through URL (optional)</Label>
          <Input
            id="ctaUrl"
            value={block.ctaUrl || ''}
            onChange={(e) => updateField('ctaUrl', e.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            Where users go when they click the image
          </p>
        </div>
      </div>
    </div>
  );
};
