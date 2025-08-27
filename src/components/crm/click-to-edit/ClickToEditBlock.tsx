import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2 } from 'lucide-react';
import { BlockEditToolbar } from './BlockEditToolbar';
import { useBlockEditMode, EditMode } from '@/hooks/useBlockEditMode';
import { TextEditMode } from './modes/TextEditMode';
import { BlockLoadingOverlay } from './BlockLoadingOverlay';
import { MediaSelectorSidebar } from '@/components/crm/MediaSelectorSidebar';
import { RegenerateBlockButton } from '../RegenerateBlockButton';

interface ClickToEditBlockProps {
  block: ContentBlock;
  index: number;
  onUpdate: (id: string, updates: Partial<ContentBlock>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (block: ContentBlock) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isGenerating?: boolean;
  campaignName?: string;
  allBlocks?: ContentBlock[];
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
  isGenerating = false,
  campaignName,
  allBlocks = [],
  children
}) => {
  const [localBlock, setLocalBlock] = useState<ContentBlock>(block);
  const blockRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<HTMLDivElement>(null);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  
  // Use the new edit mode hook
  const { editMode, setEditMode, toggleMode, exitEditMode, isTextEditing, isImageEditing } = useBlockEditMode();

  // Debug logging for MediaSelector state changes
  useEffect(() => {
    console.log('[ClickToEditBlock] MediaSelector state changed:', {
      blockId: block.id,
      blockType: block.type,
      isMediaSelectorOpen,
      editMode
    });
  }, [isMediaSelectorOpen, editMode, block.id, block.type]);

  // Sync local state with props when block changes from parent
  useEffect(() => {
    setLocalBlock(block);
  }, [block]);

  // Debounced update function to avoid excessive API calls
  const debouncedUpdate = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      const fn = (updates: Partial<ContentBlock>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onUpdate(block.id, updates);
        }, 300);
      };
      fn.flush = () => {
        clearTimeout(timeoutId);
      };
      fn.cancel = () => {
        clearTimeout(timeoutId);
      };
      return fn;
    })(),
    [block.id, onUpdate]
  );

  // Handle immediate local updates for responsive UI
  const handleLocalUpdate = useCallback((updates: Partial<ContentBlock>) => {
    const updatedBlock = { ...localBlock, ...updates };
    setLocalBlock(updatedBlock);
    // Update parent immediately for all content changes
    onUpdate(block.id, updates);
  }, [localBlock, block.id, onUpdate]);

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
    console.log('[ClickToEditBlock] handleModeChange called:', { 
      mode, 
      blockType: block.type, 
      blockId: block.id,
      currentMediaSelectorOpen: isMediaSelectorOpen 
    });
    
    if (mode === 'image') {
      // For header blocks, image mode should show the full editor interface
      if (block.type === 'header') {
        console.log('[ClickToEditBlock] Header block - toggling image edit mode');
        toggleMode('image'); // Enter image edit mode
      } else {
        // For other blocks, open media selector with proper edit mode
        console.log('[ClickToEditBlock] Non-header block - opening MediaSelector');
        setIsMediaSelectorOpen(true);
        setEditMode('image'); // Set edit mode to sync state
      }
    } else {
      toggleMode(mode);
    }
  };

  // Create local edit mode for contextual components
  const localEditMode = editMode;

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
      // Don't show text edit mode for image-only blocks
      if (block.type === 'image') {
        return;
      }
      toggleMode('text'); // Default to text editing on click
    }
  };

  const isAnyEditMode = isTextEditing || isImageEditing;

  return (
    <div className={cn("group relative click-to-edit-container", isAnyEditMode && "click-to-edit-editing")} style={{ position: 'relative', zIndex: 1 }}>
      {/* Drag Handle - appears on hover */}
      <div className="absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* New Block Edit Toolbar - only show for non-contextual blocks */}
      {block.type !== 'header' && (
        <>
          {/* Combined toolbar with regenerate and delete */}
          <div className="absolute top-2 right-2 flex items-center bg-background/95 backdrop-blur-sm border rounded-md shadow-sm p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
            <RegenerateBlockButton
              block={localBlock}
              campaignName={campaignName}
              onUpdate={(updatedBlock) => handleLocalUpdate(updatedBlock)}
              allBlocks={allBlocks}
              blockIndex={index}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(block.id);
              }}
              className="h-7 w-7 p-0 hover:bg-destructive hover:text-destructive-foreground ml-1"
              title="Delete block"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </>
      )}

      <Card
        ref={blockRef}
        className={cn(
          "transition-all duration-200 click-to-edit-block relative",
          isAnyEditMode ? "shadow-md ring-2 ring-primary/20" : "hover:shadow-sm",
          block.visible === false && "opacity-60",
          isGenerating && "bg-accent/10"
        )}
        style={{ pointerEvents: 'auto', overflow: 'visible' }}
      >
        {/* Loading overlay when content is being generated */}
        {isGenerating && <BlockLoadingOverlay />}
        {isAnyEditMode ? (
          <div ref={editingRef} className="relative">
            {/* Text Edit Mode */}
            {isTextEditing && (
              <div className="p-4">
                <TextEditMode 
                  block={localBlock}
                  onUpdate={handleLocalUpdate}
                  onSave={() => {
                    exitEditMode(); // Exit text editing mode
                  }}
                  onCancel={() => {
                    // Reset to original block state
                    setLocalBlock(block);
                    exitEditMode(); // Exit text editing mode
                  }}
                />
              </div>
            )}

            {/* Image Edit Mode */}
            {isImageEditing && (
              <div className="p-4">
                {React.cloneElement(children.editor as React.ReactElement, {
                  block: localBlock,
                  onUpdate: handleLocalUpdate,
                  isPreview: false,
                  editMode: 'image',
                  onModeChange: handleModeChange
                })}
              </div>
            )}

            {/* Preview when in edit mode but not text/image */}
            {!isTextEditing && !isImageEditing && (
              <div className="p-0">
            {React.isValidElement(children.preview) ? (
              React.cloneElement(children.preview as React.ReactElement, {
                block: localBlock,
                editMode: localEditMode,
                onModeChange: handleModeChange
              })
            ) : typeof children.preview === 'object' && children.preview !== null ? (
              <div className="p-4 text-center text-muted-foreground">
                Error: Cannot render block object directly
              </div>
            ) : (
              children.preview
            )}
              </div>
            )}
          </div>
        ) : (
          <div 
            className="p-0 cursor-pointer" 
            onClick={handleBlockClick}
            style={{ pointerEvents: 'auto' }}
          >
            {(() => {
              try {
                if (React.isValidElement(children.preview)) {
                  return React.cloneElement(children.preview as React.ReactElement, {
                    block: localBlock,
                    editMode: localEditMode,
                    onModeChange: handleModeChange
                  });
                } else if (typeof children.preview === 'object' && children.preview !== null) {
                  console.error('[ClickToEditBlock] Invalid preview object:', children.preview);
                  return (
                    <div className="p-4 text-center text-red-500 border border-red-200 rounded">
                      Error: Invalid preview content (object detected)
                    </div>
                  );
                } else {
                  return children.preview;
                }
              } catch (error) {
                console.error('[ClickToEditBlock] Error rendering preview:', error);
                return (
                  <div className="p-4 text-center text-red-500 border border-red-200 rounded">
                    Error rendering preview
                  </div>
                );
              }
            })()}
          </div>
        )}
      </Card>

      {/* MediaSelector Modal for Image Editing */}
      {(() => {
        console.log('[ClickToEditBlock] MediaSelector rendering check:', {
          isMediaSelectorOpen,
          shouldRender: !!isMediaSelectorOpen,
          blockId: block.id
        });
        return isMediaSelectorOpen;
      })() && (
        <MediaSelectorSidebar
          isOpen={isMediaSelectorOpen}
          editMode="image"
          onClose={() => {
            console.log('[ClickToEditBlock] Closing MediaSelector for block:', block.id);
            setIsMediaSelectorOpen(false);
          }}
          onImageSelect={handleImageSelect}
          contentContext={`${block.title || block.content || block.type}`}
        />
      )}
    </div>
  );
};