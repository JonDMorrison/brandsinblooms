
import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  Copy, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { ContentBlock } from '@/types/emailBuilder';

interface BlockContextMenuProps {
  block: ContentBlock;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export const BlockContextMenu: React.FC<BlockContextMenuProps> = ({
  block,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  canMoveUp,
  canMoveDown
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate Block
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onToggleVisibility}>
          {block.visible !== false ? (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              Hide Block
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Show Block
            </>
          )}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
          <ArrowUp className="h-4 w-4 mr-2" />
          Move Up
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
          <ArrowDown className="h-4 w-4 mr-2" />
          Move Down
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Block
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
