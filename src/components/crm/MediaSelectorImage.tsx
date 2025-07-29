
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

  // If in selection mode, show the MediaSelector as a modal overlay
  if (isSelecting) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${className}`}>
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleCancel}
        />
        
        {/* Modal Content */}
        <div className="relative bg-white border-2 border-primary/20 rounded-lg shadow-xl p-6 space-y-6 min-h-[700px] max-h-[90vh] overflow-hidden w-[90vw] max-w-6xl">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 sticky top-0 bg-white z-[60]">
            <h4 className="text-lg font-semibold text-gray-900">Select Image</h4>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
          <div className="w-full relative z-10 overflow-y-auto max-h-[calc(90vh-120px)]">
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
