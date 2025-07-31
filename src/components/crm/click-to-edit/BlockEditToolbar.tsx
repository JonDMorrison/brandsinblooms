import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Image, Copy, Trash2 } from 'lucide-react';
import { EditMode } from '@/hooks/useBlockEditMode';
import { cn } from '@/lib/utils';

interface BlockEditToolbarProps {
  editMode: EditMode;
  onModeChange: (mode: EditMode) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  className?: string;
  showImageButton?: boolean;
  
}

export const BlockEditToolbar: React.FC<BlockEditToolbarProps> = ({
  editMode,
  onModeChange,
  onDuplicate,
  onDelete,
  className,
  showImageButton = true,
  
}) => {
  const handleModeClick = (mode: EditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    // Toggle mode - if same mode is clicked, exit; otherwise switch
    onModeChange(editMode === mode ? null : mode);
  };

  return (
    <div className={cn(
      "absolute top-2 right-2 flex items-center gap-1",
      "bg-background/95 backdrop-blur-sm border rounded-md shadow-sm p-1",
      "opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50",
      className
    )}>
      {/* Edit Text */}
      <Button
        variant={editMode === 'text' ? 'default' : 'ghost'}
        size="sm"
        onClick={(e) => handleModeClick('text', e)}
        className="h-7 w-7 p-0"
        title="Edit text"
      >
        <Edit className="w-3 h-3" />
      </Button>

      {/* Edit Image */}
      {showImageButton && (
        <Button
          variant={editMode === 'image' ? 'default' : 'ghost'}
          size="sm"
          onClick={(e) => handleModeClick('image', e)}
          className="h-7 w-7 p-0"
          title="Edit image"
        >
          <Image className="w-3 h-3" />
        </Button>
      )}

      {/* Divider */}
      <div className="w-px h-4 bg-border mx-1" />

      {/* Duplicate */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Duplicate block"
      >
        <Copy className="w-3 h-3" />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="h-7 w-7 p-0 hover:bg-destructive hover:text-destructive-foreground"
        title="Delete block"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
};