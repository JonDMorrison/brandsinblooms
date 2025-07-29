
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
    console.log('[MediaSelectorImage] Select button clicked, opening modal');
    setIsSelecting(true);
  };

  const handleCancel = () => {
    console.log('[MediaSelectorImage] Cancel clicked, closing modal');
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
    console.log('[MediaSelectorImage] Rendering modal - isSelecting:', isSelecting, 'isLoading:', isLoading);
    
    const modalContent = (
      <div 
        style={{ 
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          padding: '16px'
        }}
        onClick={handleBackdropClick}
      >
        {/* Modal Content */}
        <div 
          style={{ 
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '24px',
            width: '90vw',
            maxWidth: '1152px',
            minHeight: '700px',
            maxHeight: '90vh',
            overflow: 'hidden',
            zIndex: 1000000,
            border: '2px solid #22C55E'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 sticky top-0 bg-white">
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
          <div className="w-full relative overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
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
