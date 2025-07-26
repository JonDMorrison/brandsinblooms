import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MediaSelector } from './MediaSelector';
import { Edit2 } from 'lucide-react';

interface ImageEditOverlayProps {
  imageUrl: string;
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  contentContext?: string;
  className?: string;
}

export const ImageEditOverlay: React.FC<ImageEditOverlayProps> = ({
  imageUrl,
  onImageSelect,
  contentContext,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handleImageSelect = (newImageUrl: string, metadata?: any) => {
    onImageSelect(newImageUrl, metadata);
    setIsOpen(false);
  };

  const handleModalClose = (open: boolean) => {
    // Only allow closing when not in preview mode
    if (!open && !isPreviewing) {
      setIsOpen(false);
    }
  };

  const handlePreviewStateChange = (previewing: boolean) => {
    console.log('[ImageEditOverlay] Preview state changed:', previewing);
    setIsPreviewing(previewing);
  };

  return (
    <div className={`relative group ${className || ''}`}>
      <img 
        src={imageUrl} 
        alt="Content" 
        className="w-full h-full object-cover rounded-lg"
      />
      
      <Dialog open={isOpen} onOpenChange={handleModalClose}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-white/95 hover:bg-white text-gray-700 hover:text-gray-900 rounded-full p-2.5 shadow-xl border border-gray-200/50 cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-2xl backdrop-blur-sm">
                    <Edit2 className="w-4 h-4" />
                  </div>
                </div>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Choose New Image</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <DialogContent 
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
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
          <MediaSelector
            onImageSelect={handleImageSelect}
            selectedImageUrl={imageUrl}
            contentContext={contentContext}
            onPreviewStateChange={handlePreviewStateChange}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};