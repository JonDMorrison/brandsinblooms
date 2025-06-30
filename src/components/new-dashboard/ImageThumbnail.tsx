
import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './ImageGallery.module.css';

interface UnsplashImage {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
}

interface ImageThumbnailProps {
  image: UnsplashImage;
  isSelected: boolean;
  onClick: (image: UnsplashImage) => void;
}

export const ImageThumbnail = ({ image, isSelected, onClick }: ImageThumbnailProps) => {
  return (
    <button
      key={image.id}
      className={cn(
        styles.thumb,
        isSelected && styles.selected
      )}
      onClick={() => onClick(image)}
      tabIndex={0}
      role="button"
      aria-label={`Select image by ${image.photographer}`}
    >
      <img
        src={image.thumb_url}
        alt={image.alt}
        className="transition-transform group-hover:scale-105"
      />
      {isSelected && (
        <div className={styles.selectedOverlay}>
          <div className={styles.checkIcon}>
            <Check className="w-3 h-3 text-white" />
          </div>
        </div>
      )}
    </button>
  );
};
