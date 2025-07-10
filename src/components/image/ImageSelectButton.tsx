import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { MediaSelector } from './MediaSelector';
import { Image as ImageIcon } from 'lucide-react';

interface ImageSelectButtonProps {
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  selectedImageUrl?: string;
  contentContext?: string;
  className?: string;
  buttonText?: string;
  mode?: "modal" | "inline";
}

export const ImageSelectButton: React.FC<ImageSelectButtonProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className,
  buttonText = "Select an Image",
  mode = "modal"
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    onImageSelect(imageUrl, metadata);
    setIsOpen(false);
  };

  // Inline mode - render MediaSelector directly
  if (mode === "inline") {
    return (
      <div className={className}>
        {selectedImageUrl && (
          <div className="relative group mb-4">
            <img 
              src={selectedImageUrl} 
              alt="Selected" 
              className="w-full h-32 object-cover rounded-lg border border-primary/20"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsOpen(true)}
                className="bg-background/90 hover:bg-background"
              >
                Change Image
              </Button>
            </div>
          </div>
        )}
        
        {/* Always show MediaSelector in inline mode */}
        <MediaSelector
          onImageSelect={handleImageSelect}
          selectedImageUrl={selectedImageUrl}
          contentContext={contentContext}
          className="w-full"
        />
      </div>
    );
  }

  // Modal mode (default)
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className={className}>
          {selectedImageUrl ? (
            <div className="relative group cursor-pointer">
              <img 
                src={selectedImageUrl} 
                alt="Selected" 
                className="w-full h-32 object-cover rounded-lg border border-primary/20"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-background/90 hover:bg-background"
                >
                  Change Image
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              variant="outline" 
              className="w-full h-32 border-2 border-dashed border-primary/30 hover:border-primary/50 bg-surface-primary/20 hover:bg-surface-primary/30 text-text-secondary hover:text-text-primary transition-all duration-200"
            >
              <div className="flex flex-col items-center gap-2">
                <ImageIcon className="w-6 h-6" />
                <span className="text-sm font-medium">{buttonText}</span>
              </div>
            </Button>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <MediaSelector
          onImageSelect={handleImageSelect}
          selectedImageUrl={selectedImageUrl}
          contentContext={contentContext}
        />
      </DialogContent>
    </Dialog>
  );
};