
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

interface UnsplashImage {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
}

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImage: UnsplashImage | null;
  onUseInPost: (image: UnsplashImage) => void;
  addingToPost: boolean;
  selectedDraft: any;
}

export const ImageModal = ({ 
  isOpen, 
  onClose, 
  selectedImage, 
  onUseInPost, 
  addingToPost, 
  selectedDraft 
}: ImageModalProps) => {
  if (!selectedImage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold pr-8">Image Preview</DialogTitle>
        </DialogHeader>
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="relative mb-4">
            <img
              src={selectedImage.download_url}
              alt={selectedImage.alt}
              className="w-full max-h-[50vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
              Photo by {selectedImage.photographer}
            </div>
          </div>
          
          <div className="flex justify-center pt-2 border-t border-gray-100">
            <Button
              variant="default"
              size="sm"
              onClick={() => onUseInPost(selectedImage)}
              disabled={addingToPost || !selectedDraft}
              className="bg-[#68BEB9] hover:bg-[#5AA8A3] shadow-md px-6"
            >
              {addingToPost ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Use in Post'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>  
    </Dialog>
  );
};
