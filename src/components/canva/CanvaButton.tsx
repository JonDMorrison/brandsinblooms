import React from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Lock } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CanvaButtonProps {
  onClick: (e?: React.MouseEvent) => void;
  disabled?: boolean;
  size?: 'sm' | 'lg' | 'default' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export const CanvaButton: React.FC<CanvaButtonProps> = ({
  onClick,
  disabled = false,
  size = 'sm',
  variant = 'outline',
  className = ''
}) => {
  const { canUseCanva } = useUserRole();

  if (!canUseCanva) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              disabled={true}
              className={`${className} opacity-50 cursor-not-allowed`}
            >
              <Lock className="w-3 h-3 mr-1" />
              Design in Canva
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contact your admin to customize images</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      <Palette className="w-3 h-3 mr-1" />
      Design in Canva
    </Button>
  );
};