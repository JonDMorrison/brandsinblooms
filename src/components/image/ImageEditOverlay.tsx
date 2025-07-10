import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
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

  const handleImageSelect = (newImageUrl: string, metadata?: any) => {
    onImageSelect(newImageUrl, metadata);
    setIsOpen(false);
  };

  return (
    <div className={`relative group ${className || ''}`}>
      <img 
        src={imageUrl} 
        alt="Content" 
        className="w-full h-full object-cover rounded-lg"
      />
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="bg-background/90 hover:bg-background text-text-primary rounded-full p-2 shadow-lg border border-primary/20 cursor-pointer transition-all duration-200 hover:scale-110">
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
        
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <MediaSelector
            onImageSelect={handleImageSelect}
            selectedImageUrl={imageUrl}
            contentContext={contentContext}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};