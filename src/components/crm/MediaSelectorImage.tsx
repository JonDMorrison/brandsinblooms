
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
      <div className={`w-full space-y-4 mb-8 ${className}`}>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <h4 className="text-sm font-medium text-gray-900">Select Image</h4>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
          <div className="w-full">
            <MediaSelector
              onImageSelect={handleImageSelect}
              selectedImageUrl={src}
              contentContext={contentContext}
              compact={true}
            />
          </div>
        </div>
      </div>
    );
  }

  // Default display mode
  return (
    <div className={`relative group w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors ${className}`}>
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
