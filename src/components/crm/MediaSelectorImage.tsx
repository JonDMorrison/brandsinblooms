
import React, { useState } from 'react';
import { MediaSelector } from '@/components/image/MediaSelector';
import { Camera, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [isSelecting, setIsSelecting] = useState(false);

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    console.log('[MediaSelectorImage] Image selected:', imageUrl, metadata);
    onChange?.(imageUrl, metadata);
    setIsSelecting(false); // Exit selection mode after choosing
  };

  const handleSelectClick = () => {
    setIsSelecting(true);
  };

  const handleCancel = () => {
    setIsSelecting(false);
  };

  // If in selection mode, show the MediaSelector inline
  if (isSelecting) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Select Image</h4>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
        <MediaSelector
          onImageSelect={handleImageSelect}
          selectedImageUrl={src}
          contentContext={contentContext}
          compact={true}
        />
      </div>
    );
  }

  // Default display mode
  return (
    <div className={`relative group w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer ${className}`}>
      {src ? (
        <img 
          src={src} 
          alt="Selected content" 
          className="object-cover w-full h-full"
        />
      ) : (
        <div className="text-center text-gray-400">
          <Camera className="w-12 h-12 mx-auto mb-2" />
          <span className="text-sm">No image selected</span>
        </div>
      )}

      <button
        onClick={handleSelectClick}
        className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-medium"
      >
        <Upload className="w-4 h-4 mr-2" />
        {src ? 'Change Image' : 'Select Image'}
      </button>
    </div>
  );
};
