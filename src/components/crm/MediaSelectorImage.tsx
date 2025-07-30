
import React, { useState } from 'react';
import { MediaSelectorSidebar } from './MediaSelectorSidebar';
import { Camera, Upload } from 'lucide-react';

interface MediaSelectorImageProps {
  src?: string;
  onChange?: (src: string, metadata?: any) => void;
  contentContext?: string;
  className?: string;
}

export const MediaSelectorImage: React.FC<MediaSelectorImageProps> = ({
  src = '',
  onChange,
  contentContext = '',
  className = ''
}) => {
  console.log('[MediaSelectorImage] Component props:', { src, hasOnChange: !!onChange, contentContext });
  
  const [isSelecting, setIsSelecting] = useState(false);

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
