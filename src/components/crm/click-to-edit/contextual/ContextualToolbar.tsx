import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Image, Palette } from 'lucide-react';
import { EditMode } from '@/hooks/useBlockEditMode';
import { cn } from '@/lib/utils';

interface ContextualToolbarProps {
  editMode: EditMode;
  onModeChange: (mode: EditMode) => void;
  onTextEdit?: () => void;
  onImageEdit?: () => void;
  onFormatEdit?: () => void;
  showTextEdit?: boolean;
  showImageEdit?: boolean;
  showFormatEdit?: boolean;
  className?: string;
}

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  editMode,
  onModeChange,
  onTextEdit,
  onImageEdit,
  onFormatEdit,
  showTextEdit = true,
  showImageEdit = true,
  showFormatEdit = true,
  className
}) => {
  const handleModeClick = (mode: EditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    onModeChange(editMode === mode ? null : mode);
  };

  return (
    <div className={cn(
      "absolute top-2 right-2 z-20",
      "flex items-center gap-1",
      "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
      className
    )}>
      {showTextEdit && (
        <Button
          variant={editMode === 'text' ? 'default' : 'secondary'}
          size="sm"
          onClick={(e) => handleModeClick('text', e)}
          className="h-7 w-7 p-0 bg-white/90 text-black hover:bg-white shadow-sm rounded-full"
          title="Edit text"
        >
          <Edit className="w-3 h-3" />
        </Button>
      )}
      
      {showImageEdit && (
        <Button
          variant={editMode === 'image' ? 'default' : 'secondary'}
          size="sm"
          onClick={(e) => {
            handleModeClick('image', e);
            onImageEdit?.();
          }}
          className="h-7 w-7 p-0 bg-white/90 text-black hover:bg-white shadow-sm rounded-full"
          title="Edit image & background"
        >
          <Image className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};