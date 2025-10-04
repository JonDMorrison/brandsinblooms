
import React, { useState, useEffect } from 'react';
import { MediaSelectorSidebar } from './MediaSelectorSidebar';
import { Camera, Upload } from 'lucide-react';
import { useUnsplash } from '@/hooks/useUnsplash';
import { buildSeasonalImageQuery } from '@/utils/seasonalImageQueryBuilder';

interface MediaSelectorImageProps {
  src?: string;
  onChange?: (src: string, metadata?: any) => void;
  contentContext?: string;
  className?: string;
  month?: string;
  weekNumber?: number;
  contentType?: 'facebook' | 'instagram' | 'blog';
  imageGenerationStatus?: string | null;
}

// Helper function to get seasonal search query based on current date
const getSeasonalSearchQuery = (): string => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();
  
  // Christmas season (Dec 1 - Dec 31)
  if (month === 11) {
    return 'christmas decorations garden winter holidays';
  }
  
  // New Year / Winter (Jan 1 - Feb 28)
  if (month === 0 || month === 1) {
    return 'winter garden snow frost evergreen';
  }
  
  // Early Spring (Mar 1 - Apr 30)
  if (month === 2 || month === 3) {
    return 'spring flowers bloom garden tulips daffodils';
  }
  
  // Late Spring / Early Summer (May 1 - Jun 30)
  if (month === 4 || month === 5) {
    return 'summer garden roses colorful flowers sunshine';
  }
  
  // Summer (Jul 1 - Aug 31)
  if (month === 6 || month === 7) {
    return 'summer garden vegetables tomatoes sunflowers';
  }
  
  // Fall (Sep 1 - Oct 31)
  if (month === 8 || month === 9) {
    return 'fall autumn garden pumpkins harvest leaves';
  }
  
  // Halloween / Thanksgiving prep (Nov 1 - Nov 30)
  if (month === 10) {
    if (day < 15) {
      return 'fall garden harvest pumpkins mums chrysanthemums';
    } else {
      return 'thanksgiving autumn harvest garden decorations';
    }
  }
  
  // Default fallback
  return 'beautiful garden flowers plants';
};

export const MediaSelectorImage: React.FC<MediaSelectorImageProps> = ({
  src = '',
  onChange,
  contentContext = '',
  className = '',
  month,
  weekNumber,
  contentType,
  imageGenerationStatus
}) => {
  console.log('[MediaSelectorImage] Component props:', { 
    src, 
    hasOnChange: !!onChange, 
    contentContext,
    imageGenerationStatus 
  });
  
  const [isSelecting, setIsSelecting] = useState(false);
  // Removed automatic Unsplash image fetching - images are now manual-only

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    console.log('[MediaSelectorImage] Image selected:', imageUrl, metadata);
    
    if (onChange) {
      onChange(imageUrl, metadata);
      console.log('[MediaSelectorImage] onChange called successfully');
    } else {
      console.error('[MediaSelectorImage] onChange prop is missing!');
    }
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[MediaSelectorImage] Select button clicked, opening sidebar');
    setIsSelecting(true);
  };

  const handleClose = () => {
    console.log('[MediaSelectorImage] Sidebar closing');
    setIsSelecting(false);
  };

  return (
    <>
      <div className={`relative group w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors ${className}`}>
        {src ? (
          <img 
            src={src} 
            alt="Selected content" 
            className="object-cover w-full h-full"
            onLoad={() => console.log('🖼️ Image loaded successfully:', src)}
            onError={(e) => console.error('🖼️ Image failed to load:', src, e)}
          />
        ) : (
          <div className="text-center text-gray-400">
            <Camera className="w-12 h-12 mx-auto mb-2" />
            <span className="text-sm">No image selected</span>
          </div>
        )}

        <button
          onClick={handleSelectClick}
          data-media-selector-button
          className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-medium z-50"
          style={{ pointerEvents: 'auto' }}
        >
          <Upload className="w-4 h-4 mr-2" />
          {src ? 'Change Image' : 'Select Image'}
        </button>
      </div>

      {/* Sidebar */}
      <MediaSelectorSidebar
        isOpen={isSelecting}
        onClose={handleClose}
        onImageSelect={handleImageSelect}
        contentContext={contentContext}
        selectedImageUrl={src}
      />
    </>
  );
};
