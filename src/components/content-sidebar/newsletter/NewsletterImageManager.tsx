
import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
}

interface NewsletterImageManagerProps {
  images: Record<number, ImageData>;
  imageErrors: Record<number, string>;
  loadingImages: boolean;
  blockIndex: number;
}

export const NewsletterImageManager: React.FC<NewsletterImageManagerProps> = ({
  images,
  imageErrors,
  loadingImages,
  blockIndex
}) => {
  if (loadingImages) {
    return (
      <div className="aspect-[4/3] bg-gray-100 rounded-lg flex items-center justify-center animate-pulse">
        <div className="text-center text-gray-500">
          <ImageIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Loading image...</p>
        </div>
      </div>
    );
  }

  if (images[blockIndex]) {
    return (
      <div className="aspect-[4/3] rounded-lg overflow-hidden shadow-sm">
        <img
          src={images[blockIndex].url}
          alt={images[blockIndex].alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.error('[NEWSLETTER] Image failed to load:', images[blockIndex].url);
            e.currentTarget.style.display = 'none';
            const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
            if (placeholder) {
              placeholder.classList.remove('hidden');
            }
          }}
        />
        <div className="hidden aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Image unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
      <div className="text-center text-gray-500 p-4">
        <ImageIcon className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm mb-1">Loading image...</p>
        {imageErrors[blockIndex] && (
          <p className="text-xs text-red-500">{imageErrors[blockIndex]}</p>
        )}
      </div>
    </div>
  );
};
