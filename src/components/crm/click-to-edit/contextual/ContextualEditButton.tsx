import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Image, Palette } from 'lucide-react';
import { EditMode } from '@/hooks/useBlockEditMode';
import { cn } from '@/lib/utils';

interface ContextualEditButtonProps {
  mode: EditMode;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  position?: 'top-left' | 'top-right' | 'top-center';
  variant?: 'text' | 'image' | 'format';
  className?: string;
}

const iconMap = {
  text: Edit,
  image: Image,
  format: Palette
};

const labelMap = {
  text: 'Edit text',
  image: 'Edit image', 
  format: 'Format block'
};

export const ContextualEditButton: React.FC<ContextualEditButtonProps> = ({
  mode,
  isActive,
  onClick,
  position = 'top-right',
  variant = 'text',
  className
}) => {
  const Icon = iconMap[variant];
  
  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2', 
    'top-center': 'top-2 left-1/2 -translate-x-1/2'
  };

  return (
    <Button
      variant={isActive ? 'default' : 'secondary'}
      size="sm"
      onClick={onClick}
      className={cn(
        "absolute z-20 h-8 w-8 p-0 shadow-lg",
        "bg-background/95 backdrop-blur-sm border",
        "opacity-0 group-hover:opacity-100 transition-all duration-200",
        "hover:scale-105",
        positionClasses[position],
        className
      )}
      title={labelMap[variant]}
    >
      <Icon className="w-3.5 h-3.5" />
    </Button>
  );
};