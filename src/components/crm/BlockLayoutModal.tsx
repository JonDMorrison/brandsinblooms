
import React from 'react';
import { EnhancedBlockLayoutModal } from './block-layout-modal/EnhancedBlockLayoutModal';

export type LayoutType = 
  | 'image-left'
  | 'image-right' 
  | 'image-vertical-left'
  | 'image-vertical-right'
  | 'text-double'
  | 'header-hero'
  | 'header-simple'
  | 'image-full'
  | 'button-centered'
  | 'newsletter-header'
  | 'quote-featured'
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
