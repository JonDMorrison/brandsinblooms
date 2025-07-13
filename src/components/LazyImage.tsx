import React, { useState, useRef, useEffect } from 'react';
import { optimizedImageService } from '@/services/optimizedImageService';
import { createLazyLoadObserver } from '@/utils/performanceOptimizations';

interface LazyImageProps {
  caption: string;
  context?: string;
  className?: string;
  alt?: string;
  fallbackSrc?: string;
  onImageLoad?: (imageUrl: string | null) => void;
  placeholder?: React.ReactNode;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  caption,
  context = 'garden center social media',
  className = '',
  alt,
  fallbackSrc,
  onImageLoad,
  placeholder
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    observerRef.current = createLazyLoadObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isInView) {
          setIsInView(true);
        }
      });
    });

    observerRef.current.observe(imgRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isInView]);

  useEffect(() => {
    if (isInView && !imageUrl && !isLoading) {
      setIsLoading(true);
      
      optimizedImageService
        .getCachedImage(caption, context)
        .then((image) => {
          const url = image?.url || fallbackSrc || null;
          setImageUrl(url);
          onImageLoad?.(url);
        })
        .catch((error) => {
          // Failed to load image
          setImageUrl(fallbackSrc || null);
          onImageLoad?.(fallbackSrc || null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isInView, caption, context, fallbackSrc, imageUrl, isLoading, onImageLoad]);

  const defaultPlaceholder = (
    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <div className="w-12 h-12 bg-slate-300 rounded-lg animate-pulse"></div>
    </div>
  );

  const loadingPlaceholder = (
    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {!isInView ? (
        placeholder || defaultPlaceholder
      ) : isLoading ? (
        loadingPlaceholder
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={alt || caption}
          className="w-full h-full object-cover"
          onError={() => {
            if (fallbackSrc && imageUrl !== fallbackSrc) {
              setImageUrl(fallbackSrc);
            }
          }}
        />
      ) : (
        placeholder || defaultPlaceholder
      )}
    </div>
  );
};