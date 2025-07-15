
import React from 'react';
import { UnsplashImage as UnsplashImageType } from '@/services/unsplashService';
import { UnsplashAttribution } from '@/components/image/UnsplashAttribution';

interface UnsplashImageProps {
  image: UnsplashImageType | null;
  className?: string;
  fallback?: React.ReactNode;
  onClick?: () => void;
  showAttribution?: boolean;
  attributionClassName?: string;
}

export const UnsplashImage: React.FC<UnsplashImageProps> = ({ 
  image, 
  className = "rounded-md object-cover w-full h-[180px]",
  fallback = null,
  onClick,
  showAttribution = true,
  attributionClassName = ""
}) => {
  if (!image?.url) {
    return fallback ? <>{fallback}</> : null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: open full image in new tab
      window.open(image.url, '_blank');
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative group cursor-pointer" onClick={handleClick}>
        <img
          src={image.thumb || image.url}
          alt={image.alt}
          loading="lazy"
          className={`${className} hover:brightness-105 transition-all duration-200 group-hover:scale-[1.02]`}
          onError={(e) => {
            console.warn('Image load error:', image.url);
            // Hide broken images gracefully
            e.currentTarget.style.display = 'none';
          }}
        />
        {image.photographer && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Photo by {image.photographer}
          </div>
        )}
      </div>
      
      {showAttribution && image.photographer && image.unsplash_id && (
        <UnsplashAttribution
          photographer={image.photographer}
          photographerUrl={image.photographer_url}
          photographerUsername={image.photographer_username}
          unsplashId={image.unsplash_id}
          imageUrl={image.url}
          downloadLocation={image.download_location}
          urls={image.urls}
          className={attributionClassName}
          compact={true}
        />
      )}
    </div>
  );
};

export default UnsplashImage;
