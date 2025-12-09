import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GalleryLayout } from './GalleryLayoutSelector';
import { GalleryImageSlot } from './GalleryImageSlot';
import { MediaSelectorSidebar } from '@/components/crm/MediaSelectorSidebar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GalleryImage {
  id: string;
  url: string;
  alt?: string;
}

interface ImageGalleryBlockPreviewProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isGenerating?: boolean;
}

// Strip HTML tags from content
const stripHtml = (html: string | undefined): string => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const getImageCount = (layout: GalleryLayout, rows?: number, cols?: number): number => {
  if (layout === 'custom' && rows && cols) {
    return rows * cols;
  }
  switch (layout) {
    case '3-across': return 3;
    case '6-across': return 6;
    case '9-images': return 9;
    default: return 3;
  }
};

const getGridColumns = (layout: GalleryLayout, cols?: number): number => {
  if (layout === 'custom' && cols) {
    return cols;
  }
  return 3;
};

const radiusMap = {
  none: 'rounded-none',
  small: 'rounded',
  medium: 'rounded-lg',
  large: 'rounded-xl',
};

const gapMap = {
  small: 'gap-2',
  medium: 'gap-3',
  large: 'gap-4',
};

export const ImageGalleryBlockPreview: React.FC<ImageGalleryBlockPreviewProps> = ({
  block,
  onUpdate,
  isGenerating = false,
}) => {
  const { toast } = useToast();
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [generatingSlots, setGeneratingSlots] = useState<Set<number>>(new Set());

  const galleryLayout = ((block as any).galleryLayout || '3-across') as GalleryLayout;
  const galleryRows = (block as any).galleryRows || 2;
  const galleryColumns = (block as any).galleryColumns || 3;
  const galleryImages: GalleryImage[] = (block as any).galleryImages || [];
  const galleryImageRadius = (block as any).galleryImageRadius || 'medium';
  const galleryGap = (block as any).galleryGap || 'medium';
  const imageCount = getImageCount(galleryLayout, galleryRows, galleryColumns);
  const gridCols = getGridColumns(galleryLayout, galleryColumns);

  const imageSlots: (GalleryImage | undefined)[] = Array.from(
    { length: imageCount },
    (_, i) => galleryImages[i]
  );

  const hasHeadline = block.headline || block.title;
  const hasBody = block.body || block.content;
  const hasCta = block.ctaText && block.ctaUrl;

  const handleImageSelect = (index: number, imageUrl: string, metadata?: { alt?: string }) => {
    // Create a new array with the right length, preserving existing images
    const newImages: GalleryImage[] = Array.from({ length: imageCount }, (_, i) => 
      galleryImages[i] || { id: `img_placeholder_${i}`, url: '', alt: '' }
    );
    
    // Set the new image at the specified index
    newImages[index] = {
      id: `img_${Date.now()}_${index}`,
      url: imageUrl,
      alt: metadata?.alt || `Gallery image ${index + 1}`,
    };
    
    // Filter out placeholder/empty images for storage
    const imagesToSave = newImages.filter(img => img.url && img.url.length > 0);
    
    console.log('[ImageGalleryBlockPreview] Saving gallery images:', {
      index,
      imageUrl: imageUrl.substring(0, 50) + '...',
      totalImages: imagesToSave.length,
    });
    
    onUpdate({
      galleryImages: imagesToSave,
      galleryLayout,
      galleryRows,
      galleryColumns,
      userEdited: true,
    } as any);
    
    setMediaSelectorOpen(false);
    setActiveSlotIndex(null);
  };

  const handleImageRemove = (index: number) => {
    const newImages = galleryImages.filter((_, i) => i !== index);
    
    console.log('[ImageGalleryBlockPreview] Removing image at index:', index);
    
    onUpdate({
      galleryImages: newImages,
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

  return (
    <div className="py-6 px-4">
      {/* Headline */}
      {hasHeadline && (
        <h2 className="text-2xl font-bold text-center mb-2" style={{ color: '#1f2937' }}>
          {block.headline || block.title}
        </h2>
      )}

      {/* Subheadline */}
      {hasBody && (
        <p className="text-center mb-6 max-w-2xl mx-auto" style={{ color: '#6b7280' }}>
          {stripHtml(block.body || block.content)}
        </p>
      )}

      {/* Interactive Image Grid */}
      <div
        className={cn(
          "grid max-w-3xl mx-auto",
          gapMap[galleryGap]
        )}
        style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        }}
      >
        {imageSlots.map((image, index) => (
          <GalleryImageSlot
            key={`preview-slot-${index}`}
            image={image}
            index={index}
            isGenerating={generatingSlots.has(index)}
            onImageSelect={(url, meta) => handleImageSelect(index, url, meta)}
            onImageRemove={() => handleImageRemove(index)}
            onOpenAIDialog={() => generateImageForSlot(index)}
            onOpenMediaSelector={() => openMediaSelectorForSlot(index)}
            onAutoPickImage={() => generateImageForSlot(index)}
            borderRadius={galleryImageRadius}
          />
        ))}
      </div>

      {/* CTA Button */}
      {hasCta && (
        <div className="flex justify-center mt-6">
          <Button
            variant="default"
            size="lg"
            asChild
          >
            <a href={block.ctaUrl} target="_blank" rel="noopener noreferrer">
              {block.ctaText}
            </a>
          </Button>
        </div>
      )}

      {/* Empty State - only when nothing at all */}
      {!hasHeadline && !hasBody && galleryImages.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="flex justify-center gap-2 mb-2">
            <div className="w-16 h-12 bg-gray-200 rounded-lg flex items-center justify-center border border-gray-300">
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <div className="w-16 h-12 bg-gray-200 rounded-lg flex items-center justify-center border border-gray-300">
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <div className="w-16 h-12 bg-gray-200 rounded-lg flex items-center justify-center border border-gray-300">
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
          </div>
          <p className="text-sm">Hover over slots to add images</p>
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
