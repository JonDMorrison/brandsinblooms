import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [localBlock, setLocalBlock] = useState<ContentBlock>(block);
  const blockRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<HTMLDivElement>(null);

  // Sync local state with props when block changes from parent
  useEffect(() => {
    setLocalBlock(block);
  }, [block]);

  // Debounced update function to avoid excessive API calls
  const debouncedUpdate = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (updates: Partial<ContentBlock>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onUpdate(block.id, updates);
        }, 300);
      };
    })(),
    [block.id, onUpdate]
  );

  // Handle immediate local updates for responsive UI
  const handleLocalUpdate = useCallback((updates: Partial<ContentBlock>) => {
    const updatedBlock = { ...localBlock, ...updates };
    setLocalBlock(updatedBlock);
    // Also update parent immediately for simple changes
    if (updates.headline || updates.body || updates.content) {
      onUpdate(block.id, updates);
    } else {
      // Debounce for style/layout changes
      debouncedUpdate(updates);
    }
  }, [localBlock, block.id, onUpdate, debouncedUpdate]);

  // Handle click outside to exit edit mode and save changes
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (editingRef.current && !editingRef.current.contains(event.target as Node)) {
        // Save any pending changes before exiting edit mode
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
    <div className={cn("group relative click-to-edit-container", isEditing && "click-to-edit-editing")} style={{ position: 'relative', zIndex: 1 }}>
      {/* Drag Handle - appears on hover */}
      <div className="absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Block Actions - appears on hover */}
      <div className="absolute -right-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 bg-background border shadow-sm hover:bg-accent"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('DropdownMenuTrigger clicked');
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[500] bg-background border shadow-lg">
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Duplicate clicked');
                onDuplicate(block);
              }}
            >
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Move up clicked');
                onMove(block.id, 'up');
              }}
              disabled={!canMoveUp}
            >
              Move Up
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Move down clicked');
                onMove(block.id, 'down');
              }}
              disabled={!canMoveDown}
            >
              Move Down
            </DropdownMenuItem>
            <DropdownMenuItem>
              Convert to
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Delete clicked');
                onRemove(block.id);
              }} 
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card
        ref={blockRef}
        className={cn(
          "transition-all duration-200 click-to-edit-block",
          isEditing ? "shadow-md ring-2 ring-primary/20" : "hover:shadow-sm",
          block.visible === false && "opacity-60"
        )}
        style={{ pointerEvents: 'auto', overflow: 'visible' }}
      >
        {isEditing ? (
          <div ref={editingRef} className="p-6 click-to-edit-editor">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Editing {block.type} block</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Cancel clicked');
                    handleCancel();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Save clicked');
                    handleSave();
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
            {React.cloneElement(children.editor as React.ReactElement, {
              block: localBlock,
              onUpdate: handleLocalUpdate
            })}
          </div>
        ) : (
          <div 
            className="p-0 cursor-pointer" 
            onClick={handleBlockClick}
            style={{ pointerEvents: 'auto' }}
          >
            {React.cloneElement(children.preview as React.ReactElement, {
              block: localBlock
            })}
          </div>
        )}
      </Card>
    </div>
  );
};