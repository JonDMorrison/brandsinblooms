import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import { BlockEditToolbar } from './BlockEditToolbar';
import { useBlockEditMode, EditMode } from '@/hooks/useBlockEditMode';
import { TextEditMode } from './modes/TextEditMode';
import { FormatEditMode } from './modes/FormatEditMode';
import { MediaSelectorSidebar } from '@/components/crm/MediaSelectorSidebar';

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
  const [localBlock, setLocalBlock] = useState<ContentBlock>(block);
  const blockRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<HTMLDivElement>(null);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  
  // Use the new edit mode hook
  const { editMode, toggleMode, exitEditMode, isTextEditing, isImageEditing, isFormatEditing } = useBlockEditMode();

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

  // Handle click outside to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editMode && editingRef.current && !editingRef.current.contains(event.target as Node)) {
        // Don't close if clicking on MediaSelector modal
        const mediaSelector = document.querySelector('[data-media-selector-sidebar]');
        if (mediaSelector && mediaSelector.contains(event.target as Node)) {
          return;
        }
        exitEditMode();
      }
    };

    if (editMode) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [editMode, exitEditMode]);

  // Handle mode changes with special logic for image mode
  const handleModeChange = (mode: EditMode) => {
    if (mode === 'image') {
      setIsMediaSelectorOpen(true);
    } else {
      toggleMode(mode);
    }
  };

  // Handle image selection from MediaSelector
  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    handleLocalUpdate({ 
      imageUrl,
      altText: metadata?.alt || metadata?.description || block.altText 
    });
    setIsMediaSelectorOpen(false);
  };

  const handleBlockClick = () => {
    if (!editMode) {
      toggleMode('text'); // Default to text editing on click
    }
  };

  const isAnyEditMode = editMode !== null;

  return (
    <div className={cn("group relative click-to-edit-container", isAnyEditMode && "click-to-edit-editing")} style={{ position: 'relative', zIndex: 1 }}>
      {/* Drag Handle - appears on hover */}
      <div className="absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* New Block Edit Toolbar - appears on hover */}
      <BlockEditToolbar
        editMode={editMode}
        onModeChange={handleModeChange}
        onDuplicate={() => onDuplicate(block)}
        onDelete={() => onRemove(block.id)}
        className="opacity-0 group-hover:opacity-100"
        showImageButton={block.type === 'image' || block.imageUrl !== undefined}
        showFormatButton={true}
      />

      <Card
        ref={blockRef}
        className={cn(
          "transition-all duration-200 click-to-edit-block",
          isAnyEditMode ? "shadow-md ring-2 ring-primary/20" : "hover:shadow-sm",
          block.visible === false && "opacity-60"
        )}
        style={{ pointerEvents: 'auto', overflow: 'visible' }}
      >
        {isAnyEditMode ? (
          <div ref={editingRef} className="relative">
            {/* Text Edit Mode */}
            {isTextEditing && (
              <div className="p-4">
                <TextEditMode 
                  block={localBlock}
                  onUpdate={handleLocalUpdate}
                />
              </div>
            )}

            {/* Format Edit Mode */}
            {isFormatEditing && (
              <div className="p-4">
                <FormatEditMode 
                  block={localBlock}
                  onUpdate={handleLocalUpdate}
                />
              </div>
            )}

            {/* Preview when in edit mode but not text/format */}
            {!isTextEditing && !isFormatEditing && (
              <div className="p-0">
                {React.cloneElement(children.preview as React.ReactElement, {
                  block: localBlock
                })}
              </div>
            )}
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

      {/* MediaSelector Modal for Image Editing */}
      {isMediaSelectorOpen && (
        <MediaSelectorSidebar
          isOpen={isMediaSelectorOpen}
          onClose={() => setIsMediaSelectorOpen(false)}
          onImageSelect={handleImageSelect}
          contentContext={`${block.type} block image`}
        />
      )}
    </div>
  );
};