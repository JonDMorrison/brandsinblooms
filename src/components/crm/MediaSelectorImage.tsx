
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [isLoading, setIsLoading] = useState(false);

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    console.log('[MediaSelectorImage] Image selected:', imageUrl, metadata);
    setIsLoading(true);
    onChange?.(imageUrl, metadata);
    
    // Add small delay to show feedback before closing
    setTimeout(() => {
      setIsLoading(false);
      setIsSelecting(false);
    }, 500);
  };

  const handleSelectClick = () => {
    setIsSelecting(true);
  };

  const handleCancel = () => {
    setIsSelecting(false);
    setIsLoading(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  // Add keyboard escape handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelecting) {
        handleCancel();
      }
    };

    if (isSelecting) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isSelecting]);

  // If in selection mode, show the MediaSelector as a modal overlay using portal
  if (isSelecting) {
    const modalContent = (
      <div 
        className={`fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto ${className}`}
        onClick={handleBackdropClick}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
          onClick={handleCancel}
        />
        
        {/* Modal Content */}
        <div 
          className="relative bg-white border-2 border-primary/20 rounded-lg shadow-xl p-6 space-y-6 min-h-[700px] max-h-[90vh] overflow-hidden w-[90vw] max-w-6xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 sticky top-0 bg-white z-[60]">
            <h4 className="text-lg font-semibold text-gray-900">
              {isLoading ? 'Processing...' : 'Select Image'}
            </h4>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCancel}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              {isLoading ? 'Processing' : 'Cancel'}
            </Button>
          </div>
          <div className="w-full relative z-10 overflow-y-auto max-h-[calc(90vh-120px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-gray-600">Selecting image...</p>
                </div>
              </div>
            ) : (
              <MediaSelector
                onImageSelect={handleImageSelect}
                selectedImageUrl={src}
                contentContext={contentContext}
                compact={true}
              />
            )}
          </div>
        </div>
      </div>
    );

    // Use React Portal to render modal outside the normal DOM flow
    return createPortal(modalContent, document.body);
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
