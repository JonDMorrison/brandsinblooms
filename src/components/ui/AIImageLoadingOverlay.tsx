import React from 'react';
import { cn } from '@/lib/utils';

interface AIImageLoadingOverlayProps {
  className?: string;
  message?: string;
}

export const AIImageLoadingOverlay: React.FC<AIImageLoadingOverlayProps> = ({ 
  className, 
  message = "Generating Images"
}) => {
  return null; // Don't render anything
};
