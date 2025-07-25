import React, { useState, useRef, useEffect } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GripVertical, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ClickToEditBlockProps {
  block: ContentBlock;
  index: number;
  onUpdate: (id: string, updates: Partial<ContentBlock>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (block: ContentBlock) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  children: {
    preview: React.ReactNode;
    editor: React.ReactNode;
  };
}

export const ClickToEditBlock: React.FC<ClickToEditBlockProps> = ({
  block,
  index,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  canMoveUp,
  canMoveDown,
  children
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<HTMLDivElement>(null);

  // Handle click outside to exit edit mode
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (editingRef.current && !editingRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  const handleBlockClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const convertToType = (newType: ContentBlock['type']) => {
    onUpdate(block.id, { type: newType });
  };

  return (
    <div className="group relative">
      {/* Drag Handle - appears on hover */}
      <div className="absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Block Actions - appears on hover */}
      <div className="absolute -right-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDuplicate(block)}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onMove(block.id, 'up')}
              disabled={!canMoveUp}
            >
              Move Up
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onMove(block.id, 'down')}
              disabled={!canMoveDown}
            >
              Move Down
            </DropdownMenuItem>
            <DropdownMenuItem>
              Convert to
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRemove(block.id)} className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card
        ref={blockRef}
        className={cn(
          "transition-all duration-200 cursor-pointer",
          isEditing ? "shadow-md ring-2 ring-primary/20" : "hover:shadow-sm",
          block.visible === false && "opacity-60"
        )}
      >
        {isEditing ? (
          <div ref={editingRef} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Editing {block.type} block</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
            {children.editor}
          </div>
        ) : (
          <div onClick={handleBlockClick} className="p-0">
            {children.preview}
          </div>
        )}
      </Card>
    </div>
  );
};