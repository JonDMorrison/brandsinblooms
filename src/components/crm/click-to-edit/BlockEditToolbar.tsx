import React from "react";
import { Button } from "@/components/ui/button";
import { Edit, Image, Copy, Trash2, Sparkles } from "lucide-react";
import { EditMode } from "@/hooks/useBlockEditMode";
import { cn } from "@/lib/utils";

interface BlockEditToolbarProps {
  editMode: EditMode;
  onModeChange: (mode: EditMode) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenAIImageDialog?: () => void;
  className?: string;
  showImageButton?: boolean;
}

export const BlockEditToolbar: React.FC<BlockEditToolbarProps> = ({
  editMode,
  onModeChange,
  onDuplicate,
  onDelete,
  onOpenAIImageDialog,
  className,
  showImageButton = true,
}) => {
  const handleModeClick = (mode: EditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    // Toggle mode - if same mode is clicked, exit; otherwise switch
    onModeChange(editMode === mode ? null : mode);
  };

  return (
    <div
      className={cn(
        "absolute top-2 right-2 flex items-center",
        "bg-background/95 backdrop-blur-sm border rounded-md shadow-sm p-1",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50",
        className,
      )}
    >
      {/* AI Image Picker */}
      {onOpenAIImageDialog && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpenAIImageDialog();
          }}
          className="h-7 w-7 p-0 hover:bg-primary hover:text-primary-foreground"
          title="AI Image Picker"
        >
          <Sparkles className="w-3 h-3" />
        </Button>
      )}

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
