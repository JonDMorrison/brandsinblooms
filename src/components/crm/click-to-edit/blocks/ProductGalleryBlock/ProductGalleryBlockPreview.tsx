import React from 'react';
import { ContentBlock, GalleryItem } from '@/types/emailBuilder';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductGalleryBlockPreviewProps {
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

export const ProductGalleryBlockPreview: React.FC<ProductGalleryBlockPreviewProps> = ({
  block,
  isGenerating = false,
}) => {
  const galleryItems: GalleryItem[] = block.galleryItems || [];
  const hasHeadline = block.headline || block.title;
  const hasBody = block.body || block.content;
  const hasCta = block.ctaText && block.ctaUrl;

  // Ensure we have 4 slots for 2x2 grid
  const itemSlots: (GalleryItem | undefined)[] = Array.from(
    { length: 4 },
    (_, i) => galleryItems[i]
  );

  return (
    <div 
      className="py-8 px-4"
      style={{ backgroundColor: '#FAF9F6' }}
    >
      {/* Headline */}
      {hasHeadline && (
        <h2 
          className="text-2xl md:text-3xl font-bold text-center mb-2"
          style={{ 
            color: '#1f2937',
            fontFamily: 'Georgia, serif'
          }}
        >
          {block.headline || block.title}
        </h2>
      )}

      {/* Subheadline */}
      {hasBody && (
        <p 
          className="text-center mb-8 max-w-lg mx-auto"
          style={{ color: '#6b7280' }}
        >
          {stripHtml(block.body || block.content)}
        </p>
      )}

      {/* 2x2 Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {itemSlots.map((item, index) => (
          <div
            key={item?.id || `slot-${index}`}
            className="rounded-xl shadow-md overflow-hidden"
            style={{ backgroundColor: '#ffffff' }}
          >
            {/* Image Container */}
            <div className="relative aspect-square">
              {item?.imageUrl ? (
                <>
                  <img
                    src={item.imageUrl}
                    alt={item.title || `Product ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {/* Badge */}
                  {item.badgeText && (
                    <div 
                      className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold"
                      style={{ 
                        backgroundColor: '#8B4B5C',
                        color: '#ffffff'
                      }}
                    >
                      {item.badgeText}
                    </div>
                  )}
                </>
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: '#f3f4f6' }}
                >
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                </div>
              )}
            </div>
            
            {/* Title */}
            {item?.title && (
              <div className="p-4 text-center">
                <p 
                  className="text-sm font-medium uppercase tracking-wide"
                  style={{ color: '#374151' }}
                >
                  {item.title}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CTA Button */}
      {hasCta && (
        <div className="flex justify-center mt-8">
          <a
            href={block.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 px-8 rounded-full text-white font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#8B4B5C' }}
          >
            {block.ctaText}
          </a>
        </div>
      )}

      {/* Empty State */}
      {!hasHeadline && !hasBody && galleryItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="flex justify-center gap-2 mb-2">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
              <ImageIcon className="h-8 w-8" />
            </div>
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
              <ImageIcon className="h-8 w-8" />
            </div>
          </div>
          <p className="text-sm">Click to add products to your gallery</p>
        </div>
      )}
    </div>
  );
};
