
import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './ImageGallery.module.css';
import { CanvaButton } from '@/components/canva/CanvaButton';

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
  onCanvaEdit?: (image: UnsplashImage) => void;
}

export const ImageThumbnail = ({ image, isSelected, onClick, onCanvaEdit }: ImageThumbnailProps) => {
  return (
    <div className="relative group">
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
      
      {/* Canva Button */}
      {onCanvaEdit && (
        <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <CanvaButton
            onClick={(e) => {
              e?.stopPropagation();
              onCanvaEdit(image);
            }}
            size="sm"
            className="bg-white/90 text-gray-800 hover:bg-white shadow-md text-xs px-2 py-1"
          />
        </div>
      )}
    </div>
  );
};
