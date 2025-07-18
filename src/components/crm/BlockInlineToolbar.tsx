import React from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Copy, Trash2 } from 'lucide-react';

interface BlockInlineToolbarProps {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  className?: string;
}

export const BlockInlineToolbar: React.FC<BlockInlineToolbarProps> = ({
  onEdit,
  onDuplicate,
  onDelete,
  className
}) => {
  return (
    <div className={`absolute top-2 right-2 flex items-center gap-1 bg-background/95 backdrop-blur-sm border rounded-md shadow-sm p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Edit block"
      >
        <Edit className="w-3 h-3" />
      </Button>
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