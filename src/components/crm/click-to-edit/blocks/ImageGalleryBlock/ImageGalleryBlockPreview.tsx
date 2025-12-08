import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GalleryLayout } from './GalleryLayoutSelector';

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
  // Create a temporary element to parse HTML and extract text
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const getImageCount = (layout: GalleryLayout): number => {
  switch (layout) {
    case '3-across': return 3;
    case '6-across': return 6;
    case '9-images': return 9;
    default: return 3;
  }
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
  const galleryLayout = ((block as any).galleryLayout || '3-across') as GalleryLayout;
  const galleryImages: GalleryImage[] = (block as any).galleryImages || [];
  const galleryImageRadius = (block as any).galleryImageRadius || 'medium';
  const galleryGap = (block as any).galleryGap || 'medium';
  const imageCount = getImageCount(galleryLayout);

  // Ensure we have the right number of image slots
  const imageSlots: (GalleryImage | undefined)[] = Array.from(
    { length: imageCount },
    (_, i) => galleryImages[i]
  );

  const hasHeadline = block.headline || block.title;
  const hasBody = block.body || block.content;
  const hasCta = block.ctaText && block.ctaUrl;
  const hasAnyImages = galleryImages.length > 0;

  return (
    <div className="py-6 px-4">
      {/* Headline */}
      {hasHeadline && (
        <h2 className="text-2xl font-bold text-center mb-2 text-foreground">
          {block.headline || block.title}
        </h2>
      )}

      {/* Subheadline */}
      {hasBody && (
        <p className="text-center text-muted-foreground mb-6 max-w-2xl mx-auto">
          {stripHtml(block.body || block.content)}
        </p>
      )}

      {/* Image Grid */}
      <div
        className={cn(
          "grid grid-cols-2 sm:grid-cols-3 max-w-3xl mx-auto",
          gapMap[galleryGap]
        )}
      >
        {imageSlots.map((image, index) => (
          <div
            key={`preview-${index}`}
            className={cn(
              "aspect-square overflow-hidden",
              radiusMap[galleryImageRadius]
            )}
          >
            {image?.url ? (
              <img
                src={image.url}
                alt={image.alt || `Gallery image ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}
          </div>
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

      {/* Empty State */}
      {!hasHeadline && !hasBody && !hasAnyImages && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="flex justify-center gap-2 mb-2">
            <ImageIcon className="h-8 w-8" />
            <ImageIcon className="h-8 w-8" />
            <ImageIcon className="h-8 w-8" />
          </div>
          <p className="text-sm">Click to add images to your gallery</p>
        </div>
      )}
    </div>
  );
};
