import React from 'react';
import { Button } from '@/components/ui-legacy/button';
import { Sparkles } from 'lucide-react';
import { ContentBlock } from '@/types/emailBuilder';

interface RegenerateBlockButtonProps {
  block: ContentBlock;
  onOpenAIImageDialog?: (blockId: string) => void;
}

/**
 * @deprecated The regenerate/shorten functionality has been replaced with AI Image Personalization Dialog.
 * This button now opens the AI Image Assistant for intelligent image generation.
 */
export const RegenerateBlockButton: React.FC<RegenerateBlockButtonProps> = ({
  block,
  onOpenAIImageDialog
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (onOpenAIImageDialog) {
      onOpenAIImageDialog(block.id);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="h-7 w-7 p-0 hover:bg-primary hover:text-primary-foreground"
      title="Open AI Image Assistant"
    >
      <Sparkles className="w-3 h-3" />
    </Button>
  );
};