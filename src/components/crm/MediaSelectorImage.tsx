
import React, { useState } from 'react';
import { MediaSelector } from '@/components/image/MediaSelector';
import { Camera, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    console.log('[MediaSelectorImage] Image selected before calling onChange:', imageUrl, metadata);
    onChange?.(imageUrl, metadata);
    console.log('[MediaSelectorImage] onChange called successfully');
    // Modal will close only after successful selection from MediaSelector
    setIsOpen(false);
  };

  const handleModalClose = (open: boolean) => {
    // Only allow closing when not in preview mode
    if (!open && !isPreviewing) {
      setIsOpen(false);
    }
  };

  const handlePreviewStateChange = (previewing: boolean) => {
    console.log('[MediaSelectorImage] Preview state changed:', previewing);
    setIsPreviewing(previewing);
  };

  return (
    <>
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
          onClick={() => setIsOpen(true)}
          className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-medium"
        >
          <Upload className="w-4 h-4 mr-2" />
          {src ? 'Change Image' : 'Select Image'}
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={handleModalClose}>
        <DialogContent 
          className="max-w-4xl max-h-[90vh] overflow-y-auto" 
          aria-describedby="media-selector-desc"
          onPointerDownOutside={(e) => {
            if (isPreviewing) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (isPreviewing) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (isPreviewing) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Select Image</DialogTitle>
          </DialogHeader>
          <p id="media-selector-desc" className="sr-only">Browse and select an image from our collection or search for specific content to add to your campaign.</p>
          <div onClick={(e) => e.stopPropagation()}>
            <MediaSelector
              onImageSelect={handleImageSelect}
              selectedImageUrl={src}
              contentContext={contentContext}
              onPreviewStateChange={handlePreviewStateChange}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
