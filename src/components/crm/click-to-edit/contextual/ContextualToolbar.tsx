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
      "absolute top-0 left-0 right-0 z-20",
      "flex items-center justify-between",
      "p-3 bg-black/30 backdrop-blur-sm",
      "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
      className
    )}>
      {/* Left: Edit Text */}
      <div className="flex">
        {showTextEdit && (
          <Button
            variant={editMode === 'text' ? 'default' : 'secondary'}
            size="sm"
            onClick={(e) => handleModeClick('text', e)}
            className="h-8 px-3 bg-white/90 text-black hover:bg-white shadow-sm"
            title="Edit text"
          >
            <Edit className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs font-medium">Edit Text</span>
          </Button>
        )}
      </div>

      {/* Center: Format */}
      <div className="flex">
        {showFormatEdit && (
          <Button
            variant={editMode === 'format' ? 'default' : 'secondary'}
            size="sm"
            onClick={(e) => handleModeClick('format', e)}
            className="h-8 px-3 bg-white/90 text-black hover:bg-white shadow-sm"
            title="Format block"
          >
            <Palette className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs font-medium">Format</span>
          </Button>
        )}
      </div>

      {/* Right: Edit Image */}
      <div className="flex">
        {showImageEdit && (
          <Button
            variant={editMode === 'image' ? 'default' : 'secondary'}
            size="sm"
            onClick={(e) => {
              handleModeClick('image', e);
              onImageEdit?.();
            }}
            className="h-8 px-3 bg-white/90 text-black hover:bg-white shadow-sm"
            title="Change background image"
          >
            <Image className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs font-medium">Change Image</span>
          </Button>
        )}
      </div>
    </div>
  );
};