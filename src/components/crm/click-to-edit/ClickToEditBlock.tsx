import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2, Edit, Zap, CheckCircle, AlertTriangle, Layers, Grid3X3 } from 'lucide-react';
import { BlockEditToolbar } from './BlockEditToolbar';
import { useBlockEditMode, EditMode } from '@/hooks/useBlockEditMode';
import { TextEditMode } from './modes/TextEditMode';
import { BlockLoadingOverlay } from './BlockLoadingOverlay';
import { MediaSelectorSidebar } from '@/components/crm/MediaSelectorSidebar';
import { ImageActionMenu } from './ImageActionMenu';
import { assessContentQuality, sanitizeAndImproveContent } from '@/utils/contentQuality';
import { ImageOverlayDialog } from './ImageOverlayDialog';
import { GalleryGridConfigDialog } from './blocks/ImageGalleryBlock/GalleryGridConfigDialog';
import { useAIImageGeneration } from '@/hooks/useAIImageGeneration';
import { useToast } from '@/hooks/use-toast';
import { hasActiveEditOverlays, registerEditOverlay, unregisterEditOverlay } from './editOverlayRegistry';

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
  retryImageGeneration?: (blockId: string) => void;
  onOpenAIImageDialog?: (blockId: string) => void;
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
  retryImageGeneration,
  onOpenAIImageDialog,
  children
}) => {
  const [localBlock, setLocalBlock] = useState<ContentBlock>(block);
  const blockRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<HTMLDivElement>(null);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [isOverlayDialogOpen, setIsOverlayDialogOpen] = useState(false);
  const [isGridConfigOpen, setIsGridConfigOpen] = useState(false);
  
  // Use the new edit mode hook
  const { editMode, setEditMode, toggleMode, exitEditMode, isTextEditing, isImageEditing, isFormatEditing } = useBlockEditMode();
  
  // AI Image Generation hook
  const { generateSingleImage } = useAIImageGeneration();
  const { toast } = useToast();

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

  // Handle immediate local updates with content sanitization
  const handleLocalUpdate = useCallback((updates: Partial<ContentBlock>) => {
    console.log('[ClickToEditBlock] handleLocalUpdate called:', {
      blockId: block.id,
      blockType: block.type,
      updates,
      hasOverlayData: !!(updates.overlayOpacity || updates.overlayColor)
    });
    
    // Sanitize text content automatically
    const sanitizedUpdates = { ...updates };
    if (updates.content && typeof updates.content === 'string') {
      sanitizedUpdates.content = sanitizeAndImproveContent(updates.content);
    }
    if (updates.title && typeof updates.title === 'string') {
      sanitizedUpdates.title = sanitizeAndImproveContent(updates.title);
    }
    if (updates.headline && typeof updates.headline === 'string') {
      sanitizedUpdates.headline = sanitizeAndImproveContent(updates.headline);
    }
    
    const updatedBlock = { ...localBlock, ...sanitizedUpdates };
    setLocalBlock(updatedBlock);
    // Update parent immediately for all content changes
    console.log('[ClickToEditBlock] Calling parent onUpdate with:', { blockId: block.id, sanitizedUpdates });
    onUpdate(block.id, sanitizedUpdates);
  }, [localBlock, block.id, onUpdate]);

  // Strengthen content function for weak blocks
  const handleStrengthenContent = async () => {
    try {
      const contentToImprove = block.content || block.title || block.headline || '';
      if (!contentToImprove.trim()) return;

      // For now, use a simple AI-powered improvement approach
      // We'll enhance this with the regeneration service when types are aligned
      const improved = sanitizeAndImproveContent(contentToImprove);
      
      // Apply the improvement to the appropriate field
      if (block.content) {
        handleLocalUpdate({ content: improved });
      } else if (block.title) {
        handleLocalUpdate({ title: improved });
      } else if (block.headline) {
        handleLocalUpdate({ headline: improved });
      }
    } catch (error) {
      console.error('Error strengthening content:', error);
    }
  };

  // Register/unregister media selector with overlay registry
  useEffect(() => {
    if (isMediaSelectorOpen) {
      registerEditOverlay('media-selector');
    } else {
      unregisterEditOverlay('media-selector');
    }
    return () => {
      unregisterEditOverlay('media-selector');
    };
  }, [isMediaSelectorOpen]);

  // Helper to check if click/focus is inside an allowed editing overlay (DOM fallback)
  const isInsideAllowedOverlay = (target: HTMLElement | null): boolean => {
    if (!target) return false;

    // MediaSelector sidebar/modal
    const mediaSelector = document.querySelector('[data-media-selector-sidebar]');
    if (mediaSelector && mediaSelector.contains(target)) return true;

    // MergeTagPicker popover (explicit data attribute)
    if (target.closest('[data-merge-tag-picker="true"]')) return true;

    // Generic allowlist for any future editing overlays
    if (target.closest('[data-click-to-edit-allowed-overlay="true"]')) return true;

    // Also check the overlay-root wrapper from popover.tsx
    if (target.closest('[data-overlay-root]')) return true;

    return false;
  };

  // Focus-based edit mode exit (portal-safe)
  // Uses focusin events to detect when focus moves outside editor AND no overlays are active
  useEffect(() => {
    if (!editMode) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // If focus is inside the editor container, keep edit mode
      if (editingRef.current && editingRef.current.contains(target)) return;

      // If there is an active overlay (merge tag picker, media selector), keep edit mode
      if (hasActiveEditOverlays()) return;

      // Also check DOM as fallback (for overlays that may not have registered yet)
      if (isInsideAllowedOverlay(target)) return;

      // Focus moved outside editor and no overlays are open -> exit
      exitEditMode();
    };

    // Also handle clicks for non-focusable areas
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // If click is inside editor container, do nothing
      if (editingRef.current && editingRef.current.contains(target)) return;

      // If there is an active overlay, keep edit mode
      if (hasActiveEditOverlays()) return;

      // DOM fallback check
      if (isInsideAllowedOverlay(target)) return;

      exitEditMode();
    };

    // Handle Escape key to exit edit mode when no overlays are active
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Let overlays handle Escape first (Radix will close popover)
        // Only exit edit mode if no overlays are active after a small delay
        setTimeout(() => {
          if (!hasActiveEditOverlays()) {
            exitEditMode();
          }
        }, 50);
      }
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
    console.log('🖼️ Image selected for block:', block.type, 'URL:', imageUrl);
    
    // For newsletter headers, update backgroundImageUrl instead of imageUrl
    if (block.type === 'newsletter-header') {
      handleLocalUpdate({ 
        backgroundImageUrl: imageUrl,
        altText: metadata?.alt || metadata?.description || block.altText 
      });
    } else {
      handleLocalUpdate({ 
        imageUrl,
        altText: metadata?.alt || metadata?.description || block.altText 
      });
    }
    setIsMediaSelectorOpen(false);
  };

  const handleBlockClick = () => {
    if (!editMode) {
      // Don't toggle edit mode for image gallery blocks - users interact with grid items directly
      if (block.type === 'image-gallery') {
        return;
      }
      
      // Don't show text edit mode for image-only blocks (full-width images, graphic-hero)
      // These blocks don't have text content to edit
      const isImageOnlyBlock = 
        block.type === 'graphic-hero' ||
        (block.type === 'image' && block.layout === 'full-width') ||
        (block.type === 'image' && !block.content && !block.title && !block.headline && !block.body);
      
      if (isImageOnlyBlock) {
        return;
      }
      toggleMode('text'); // Default to text editing on click
    }
  };

  // Auto Pick Image Handler - generates image based on block content or seasonal fallback
  const handleAutoPickImage = async () => {
    try {
      // Check if block has any content
      const blockContent = block.title || block.headline || block.body || block.content;
      
      // Determine the content context for image generation
      let contentContext: string;
      let contentTitle: string | undefined;
      
      if (blockContent && blockContent.trim()) {
        // Use existing block content as context
        contentContext = blockContent;
        contentTitle = block.title || block.headline || undefined;
        console.log('🎨 Auto Pick: Using block content for image generation');
      } else {
        // Fallback to seasonal garden imagery
        const currentMonth = new Date().getMonth();
        let season = 'spring';
        if (currentMonth >= 2 && currentMonth <= 4) season = 'spring';
        else if (currentMonth >= 5 && currentMonth <= 7) season = 'summer';
        else if (currentMonth >= 8 && currentMonth <= 10) season = 'fall';
        else season = 'winter';
        
        contentContext = `Beautiful ${season} garden with flowers, plants, and lush greenery. Garden center atmosphere with vibrant blooms and foliage.`;
        contentTitle = `${season.charAt(0).toUpperCase() + season.slice(1)} Garden`;
        console.log(`🎨 Auto Pick: Using seasonal fallback (${season}) for image generation`);
      }
      
      // Set loading state
      handleLocalUpdate({ isGeneratingImage: true, imageGenerationError: undefined });
      
      // Generate the image
      const imageUrl = await generateSingleImage({
        contentContext,
        contentTitle,
        channel: 'newsletter',
        uploadToStorage: true
      });
      
      if (imageUrl) {
        // Update the block with the generated image
        if (block.type === 'newsletter-header') {
          handleLocalUpdate({ 
            backgroundImageUrl: imageUrl, 
            isGeneratingImage: false,
            imageGenerationError: undefined
          });
        } else {
          handleLocalUpdate({ 
            imageUrl, 
            isGeneratingImage: false,
            imageGenerationError: undefined
          });
        }
        
        toast({
          title: 'Image generated!',
          description: 'AI image has been added to your block.'
        });
      } else {
        throw new Error('Failed to generate image');
      }
    } catch (error: any) {
      console.error('❌ Auto Pick image generation failed:', error);
      handleLocalUpdate({ 
        isGeneratingImage: false, 
        imageGenerationError: error.message || 'Failed to generate image'
      });
      
      toast({
        title: 'Image generation failed',
        description: 'Please try again or select an image manually.',
        variant: 'destructive'
      });
    }
  };

  const isAnyEditMode = isTextEditing || isImageEditing || isFormatEditing;

  return (
    <div className={cn("group relative click-to-edit-container", isAnyEditMode && "click-to-edit-editing")} style={{ position: 'relative', zIndex: 1 }}>
      {/* Drag Handle - appears on hover */}
      <div className="absolute -left-8 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Combined Block Edit Toolbar - only show for non-header blocks */}
      {block.type !== 'header' && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white backdrop-blur-sm border rounded-md shadow-sm p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
          {/* Text Edit Button - hide for image-only blocks without text content */}
          {(block.type !== 'image' || block.content || block.title) && (
            <Button
              variant={editMode === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleModeChange('text');
              }}
              className="h-7 w-7 p-0 hover:bg-muted"
              title="Edit text"
            >
              <Edit className="w-3 h-3" />
            </Button>
          )}
          
          {/* Unified Image Action Menu */}
          <ImageActionMenu
            block={localBlock}
            editMode={editMode}
            onModeChange={handleModeChange}
            onAutoPickImage={handleAutoPickImage}
            onOpenAIImageDialog={onOpenAIImageDialog ? () => onOpenAIImageDialog(block.id) : undefined}
            disabled={block.isGeneratingImage}
          />

          {/* Grid Config Button - only show for image-gallery blocks */}
          {block.type === 'image-gallery' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsGridConfigOpen(true);
              }}
              className="h-7 w-7 p-0 hover:bg-muted"
              title="Configure grid layout"
            >
              <Grid3X3 className="w-3 h-3" />
            </Button>
          )}

          {/* Image Overlay Button - only show for Newsletter Header blocks */}
          {block.type === 'newsletter-header' && (block.imageUrl || block.backgroundImageUrl) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsOverlayDialogOpen(true);
              }}
              className="h-7 w-7 p-0 hover:bg-muted"
              title="Edit image overlay"
            >
              <Layers className="w-3 h-3" />
            </Button>
          )}
          
          {/* Content Quality Indicator & Strengthen Button */}
          {(() => {
            const contentToCheck = block.content || block.title || block.headline || '';
            const quality = assessContentQuality(contentToCheck, 'body');
            
            if (contentToCheck && (quality.level === 'poor' || quality.level === 'fair')) {
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStrengthenContent();
                  }}
                  className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600"
                  title="Strengthen content"
                >
                  <Zap className="w-3 h-3" />
                </Button>
              );
            }
            return null;
          })()}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(block.id);
            }}
            className="h-7 w-7 p-0 hover:bg-destructive hover:text-destructive-foreground"
            title="Delete block"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}

      <Card
        ref={blockRef}
        className={cn(
          "transition-all duration-200 click-to-edit-block relative",
          isAnyEditMode ? "shadow-md ring-2 ring-primary/20" : "hover:shadow-sm",
          block.visible === false && "opacity-60",
          isGenerating && "bg-accent/10"
        )}
        style={{ pointerEvents: 'auto', overflow: 'visible', backgroundColor: '#ffffff' }}
      >
        {/* Loading overlay when content is being generated */}
        {isGenerating && <BlockLoadingOverlay />}
        
        {/* Image generation error state */}
        {block.imageGenerationError && retryImageGeneration && (
          <div className="absolute top-12 right-2 z-20">
            <div className="bg-destructive/10 border border-destructive rounded-md p-2 flex items-center gap-2">
              <span className="text-xs text-destructive">Image failed</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  retryImageGeneration(block.id);
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        {isAnyEditMode ? (
          <div ref={editingRef} className="relative">
            {/* Text Edit Mode */}
            {isTextEditing && (
              <div className="p-4">
                <TextEditMode 
                  block={localBlock}
                  onUpdate={handleLocalUpdate}
                  onSave={() => {
                    console.log('💾 ClickToEditBlock: Save callback triggered');
                    console.log('🔍 Current localBlock state:', {
                      id: localBlock.id,
                      type: localBlock.type,
                      title: localBlock.title,
                      headline: localBlock.headline,
                      content: localBlock.content,
                      body: localBlock.body,
                      ctaText: localBlock.ctaText,
                      ctaUrl: localBlock.ctaUrl,
                      buttonText: localBlock.buttonText,
                      buttonUrl: localBlock.buttonUrl
                    });
                    // Final commit of changes and exit edit mode
                    onUpdate(block.id, localBlock);
                    exitEditMode();
                  }}
                  onCancel={() => {
                    // Reset to original block state
                    setLocalBlock(block);
                    exitEditMode();
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
                  onClose: exitEditMode,
                  isPreview: false,
                  editMode: 'image',
                  onModeChange: handleModeChange
                })}
              </div>
            )}

            {/* Format Edit Mode - shows preview with color picker overlay */}
            {isFormatEditing && (
              <div className="p-0">
                {React.isValidElement(children.preview) ? (
                  React.cloneElement(children.preview as React.ReactElement, {
                    block: localBlock,
                    editMode: localEditMode,
                    onModeChange: handleModeChange,
                    onOpenAIImageDialog
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

            {/* Preview when in edit mode but not text/image/format */}
            {!isTextEditing && !isImageEditing && !isFormatEditing && (
              <div className="p-0">
            {React.isValidElement(children.preview) ? (
              React.cloneElement(children.preview as React.ReactElement, {
                block: localBlock,
                editMode: localEditMode,
                onModeChange: handleModeChange,
                onOpenAIImageDialog
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
            className={cn(
              "p-0",
              block.type !== 'image-gallery' && "cursor-pointer"
            )}
            onClick={handleBlockClick}
            style={{ pointerEvents: 'auto' }}
          >
            {(() => {
              try {
                if (React.isValidElement(children.preview)) {
                  return React.cloneElement(children.preview as React.ReactElement, {
                    block: localBlock,
                    editMode: localEditMode,
                    onModeChange: handleModeChange,
                    onOpenAIImageDialog
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

      {/* Image Overlay Dialog */}
      <ImageOverlayDialog
        isOpen={isOverlayDialogOpen}
        onClose={() => setIsOverlayDialogOpen(false)}
        block={localBlock}
        onUpdate={handleLocalUpdate}
      />

      {/* Gallery Grid Config Dialog */}
      <GalleryGridConfigDialog
        isOpen={isGridConfigOpen}
        onClose={() => setIsGridConfigOpen(false)}
        currentRows={(localBlock as any).galleryRows || 2}
        currentColumns={(localBlock as any).galleryColumns || 3}
        onApply={(rows, columns) => {
          handleLocalUpdate({
            galleryLayout: 'custom',
            galleryRows: rows,
            galleryColumns: columns,
          } as any);
        }}
      />
    </div>
  );
};