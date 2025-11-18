import React from 'react';
import { cn } from '@/lib/utils';

interface AIImageLoadingOverlayProps {
  message?: string;
  className?: string;
}

export const AIImageLoadingOverlay: React.FC<AIImageLoadingOverlayProps> = ({
  message = 'Generating Images',
  className
}) => {
  return null; // Don't render anything
};
