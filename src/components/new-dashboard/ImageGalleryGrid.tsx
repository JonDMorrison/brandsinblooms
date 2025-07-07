
import React from 'react';
import { Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageThumbnail } from './ImageThumbnail';
import styles from './ImageGallery.module.css';

interface UnsplashImage {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
}

interface ImageGalleryGridProps {
  loading: boolean;
  images: UnsplashImage[];
  selectedImage: UnsplashImage | null;
  lastQuery: string;
  onImageClick: (image: UnsplashImage) => void;
  onRetryFetch: () => void;
  onCanvaEdit?: (image: UnsplashImage) => void;
}

export const ImageGalleryGrid = ({ 
  loading, 
  images, 
  selectedImage, 
  lastQuery,
  onImageClick,
  onRetryFetch,
  onCanvaEdit
}: ImageGalleryGridProps) => {
  if (loading) {
    return (
      <div className={styles.galleryGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={styles.loadingPlaceholder}>
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className={styles.emptyState}>
        <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
        <p className="text-xs text-gray-500 mb-1">No images found for "{lastQuery}"</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetryFetch}
          className="mt-2 text-xs"
        >
          Try different search
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.galleryGrid}>
      {images.map((image) => (
        <ImageThumbnail
          key={image.id}
          image={image}
          isSelected={selectedImage?.id === image.id}
          onClick={onImageClick}
          onCanvaEdit={onCanvaEdit}
        />
      ))}
    </div>
  );
};
