
import React from 'react';
import { EnhancedBlockLayoutModal } from './block-layout-modal/EnhancedBlockLayoutModal';

export type LayoutType = 
  | 'image-left'
  | 'image-right' 
  | 'image-vertical-left'
  | 'image-vertical-right'
  | 'text-double'
  | 'text-triple'
  | 'header-hero'
  | 'header-simple'
  | 'image-full'
  | 'button-centered'
  | 'button-left'
  | 'button-right'
  | 'newsletter-header'
  | 'quote-featured'
  | 'cta-primary'
  | 'image-60-40'
  | 'image-70-30'
  | 'image-overlay'
  | 'image-background';

interface BlockLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (layoutType: LayoutType) => void;
}

export const BlockLayoutModal: React.FC<BlockLayoutModalProps> = (props) => {
  return <EnhancedBlockLayoutModal {...props} />;
};
