import React, { useState, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { GalleryLayoutSelector, GalleryLayout } from './GalleryLayoutSelector';
import { GalleryImageSlot } from './GalleryImageSlot';
import { MediaSelectorSidebar } from '@/components/crm/MediaSelectorSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GalleryImage {
  id: string;
  url: string;
  alt?: string;
}

interface ImageGalleryBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onClose?: () => void;
  isGenerating?: boolean;
}

const getImageCount = (layout: GalleryLayout): number => {
  switch (layout) {
    case '3-across': return 3;
    case '6-across': return 6;
    case '9-images': return 9;
    default: return 3;
  }
};

export const ImageGalleryBlockEditor: React.FC<ImageGalleryBlockEditorProps> = ({
  block,
  onUpdate,
  onClose,
  isGenerating = false,
}) => {
  const { toast } = useToast();
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [generatingSlots, setGeneratingSlots] = useState<Set<number>>(new Set());
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const galleryLayout = (block as any).galleryLayout || '3-across';
  const galleryImages: GalleryImage[] = (block as any).galleryImages || [];
  const galleryImageRadius = (block as any).galleryImageRadius || 'medium';
  const imageCount = getImageCount(galleryLayout);

  // Ensure we have the right number of image slots
  const imageSlots: (GalleryImage | undefined)[] = Array.from(
    { length: imageCount },
    (_, i) => galleryImages[i]
  );

  const handleLayoutChange = (layout: GalleryLayout) => {
    onUpdate({
      ...block,
      galleryLayout: layout,
    } as any);
  };

  const handleImageSelect = (index: number, imageUrl: string, metadata?: { alt?: string }) => {
    const newImages = [...galleryImages];
    newImages[index] = {
      id: `img_${Date.now()}_${index}`,
      url: imageUrl,
      alt: metadata?.alt || `Gallery image ${index + 1}`,
    };
    
    onUpdate({
      ...block,
      galleryImages: newImages,
      userEdited: true,
    } as any);
    
    setMediaSelectorOpen(false);
    setActiveSlotIndex(null);
  };

  const handleImageRemove = (index: number) => {
    const newImages = [...galleryImages];
    newImages[index] = undefined as any;
    // Filter out undefined values but maintain order
    const filteredImages = newImages.filter(Boolean);
    
    onUpdate({
      ...block,
      galleryImages: filteredImages,
      userEdited: true,
    } as any);
  };

  const openMediaSelectorForSlot = (index: number) => {
    setActiveSlotIndex(index);
    setMediaSelectorOpen(true);
  };

  const generateImageForSlot = async (index: number) => {
    setGeneratingSlots(prev => new Set(prev).add(index));
    
    try {
      const contentContext = [
        block.headline,
        block.body,
        `gallery image ${index + 1}`,
      ].filter(Boolean).join(' - ');

      const { data, error } = await supabase.functions.invoke('generate-ai-image', {
        body: {
          channel: 'email',
          contentType: 'gallery',
          headline: block.headline || 'Gallery Image',
          bodyText: block.body || '',
          additionalContext: contentContext,
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        handleImageSelect(index, data.imageUrl, { alt: data.altText });
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
      toast({
        title: "Image generation failed",
        description: "Please try again or upload an image manually.",
        variant: "destructive",
      });
    } finally {
      setGeneratingSlots(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const generateAllEmptyImages = async () => {
    const emptySlots = imageSlots
      .map((img, idx) => (!img ? idx : -1))
      .filter(idx => idx !== -1);

    if (emptySlots.length === 0) {
      toast({
        title: "All slots filled",
        description: "All image slots already have images.",
      });
      return;
    }

    setIsGeneratingAll(true);
    
    try {
      for (const slotIndex of emptySlots) {
        await generateImageForSlot(slotIndex);
      }
      
      toast({
        title: "Images generated",
        description: `Generated ${emptySlots.length} images successfully.`,
      });
    } catch (err) {
      console.error('Failed to generate all images:', err);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const emptySlotCount = imageSlots.filter(img => !img).length;

  return (
    <div className="space-y-6 p-4">
      {/* Layout Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Gallery Layout</Label>
        <GalleryLayoutSelector
          value={galleryLayout}
          onChange={handleLayoutChange}
        />
      </div>

      {/* Headline */}
      <div className="space-y-2">
        <Label htmlFor="gallery-headline">Headline</Label>
        <Input
          id="gallery-headline"
          value={block.headline || ''}
          onChange={(e) => onUpdate({ headline: e.target.value, title: e.target.value, userEdited: true })}
          placeholder="Gallery Headline"
          className="text-lg font-semibold"
        />
      </div>

      {/* Subheadline / Body */}
      <div className="space-y-2">
        <Label htmlFor="gallery-body">Subheadline</Label>
        <Input
          id="gallery-body"
          value={block.body || ''}
          onChange={(e) => onUpdate({ body: e.target.value, content: e.target.value, userEdited: true })}
          placeholder="Optional description text"
        />
      </div>

      {/* Generate All Button */}
      {emptySlotCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={generateAllEmptyImages}
            disabled={isGeneratingAll || generatingSlots.size > 0}
            className="gap-2"
          >
            {isGeneratingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating {emptySlotCount} images...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate All ({emptySlotCount} empty)
              </>
            )}
          </Button>
        </div>
      )}

      {/* Image Grid */}
      <div className="space-y-2">
        <Label>Images</Label>
        <div
          className={cn(
            "grid gap-3",
            "grid-cols-3" // Always 3 columns
          )}
        >
          {imageSlots.map((image, index) => (
            <GalleryImageSlot
              key={`slot-${index}`}
              image={image}
              index={index}
              isGenerating={generatingSlots.has(index)}
              onImageSelect={(url, meta) => handleImageSelect(index, url, meta)}
              onImageRemove={() => handleImageRemove(index)}
              onOpenAIDialog={() => generateImageForSlot(index)}
              onOpenMediaSelector={() => openMediaSelectorForSlot(index)}
              borderRadius={galleryImageRadius}
            />
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="space-y-4 pt-4 border-t">
        <Label className="text-sm font-medium">Call to Action (Optional)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="gallery-cta-text" className="text-xs">Button Text</Label>
            <Input
              id="gallery-cta-text"
              value={block.ctaText || ''}
              onChange={(e) => onUpdate({ ctaText: e.target.value, buttonText: e.target.value })}
              placeholder="View Gallery"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gallery-cta-url" className="text-xs">Button URL</Label>
            <Input
              id="gallery-cta-url"
              value={block.ctaUrl || ''}
              onChange={(e) => onUpdate({ ctaUrl: e.target.value, buttonUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Save & Close Button */}
      {onClose && (
        <div className="pt-4 border-t">
          <Button
            onClick={onClose}
            className="w-full gap-2"
          >
            <Check className="h-4 w-4" />
            Save & Close
          </Button>
        </div>
      )}

      {/* Media Selector Sidebar */}
      <MediaSelectorSidebar
        isOpen={mediaSelectorOpen}
        onClose={() => {
          setMediaSelectorOpen(false);
          setActiveSlotIndex(null);
        }}
        onImageSelect={(imageUrl, metadata) => {
          if (activeSlotIndex !== null) {
            handleImageSelect(activeSlotIndex, imageUrl, { alt: metadata?.alt });
          }
        }}
        contentContext={block.headline || 'Gallery image'}
      />
    </div>
  );
};
