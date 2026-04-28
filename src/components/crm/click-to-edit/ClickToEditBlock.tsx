import React, { useState, useRef, useEffect, useCallback } from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { Card } from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { cn } from "@/lib/utils";
import { GripVertical, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BlockMiniPreview } from "../blocks/BlockMiniPreview";
import { BlockEditToolbar } from "./BlockEditToolbar";
import { useBlockEditMode, EditMode } from "@/hooks/useBlockEditMode";
import { TextEditMode } from "./modes/TextEditMode";
import { BlockLoadingOverlay } from "./BlockLoadingOverlay";
import { MediaSelectorSidebar } from "@/components/crm/MediaSelectorSidebar";
import { ToolsDropdownMenu } from "./ToolsDropdownMenu";
import {
  assessContentQuality,
  sanitizeAndImproveContent,
} from "@/utils/contentQuality";
import { ImageOverlayDialog } from "./ImageOverlayDialog";
import { GalleryGridConfigDialog } from "./blocks/ImageGalleryBlock/GalleryGridConfigDialog";
import { useAIImageGeneration } from "@/hooks/useAIImageGeneration";
import { useToast } from "@/hooks/use-toast";
import {
  hasActiveEditOverlays,
  registerEditOverlay,
  unregisterEditOverlay,
} from "./editOverlayRegistry";
import {
  getBlockDisplayLabel,
  validateBlockBeforeSave,
} from "@/lib/crm/campaignBuilderValidation";

const GALLERY_BLOCK_TYPES = new Set<ContentBlock["type"]>([
  "image-gallery",
  "product-gallery",
]);

function cloneContentBlock(sourceBlock: ContentBlock): ContentBlock {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(sourceBlock);
  }

  return JSON.parse(JSON.stringify(sourceBlock)) as ContentBlock;
}

function areBlocksEqual(left: ContentBlock, right: ContentBlock): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export interface ClickToEditBlockEditSession {
  blockId: string;
  blockLabel: string;
  isDirty: boolean;
  save: () => boolean;
  discard: () => void;
  cancel: () => void;
}

interface ClickToEditBlockProps {
  block: ContentBlock;
  index: number;
  onUpdate: (id: string, updates: Partial<ContentBlock>) => void;
  onRemove: (id: string) => void;
  onConfirmRemove?: (id: string) => void;
  onCancelRemove?: () => void;
  isDeletePending?: boolean;
  onDuplicate: (block: ContentBlock) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isGenerating?: boolean;
  campaignName?: string;
  allBlocks?: ContentBlock[];
  retryImageGeneration?: (blockId: string) => void;
  onOpenAIImageDialog?: (blockId: string) => void;
  onRequestOpenEditor?: (blockId: string, openEditor: () => void) => void;
  onEditSessionChange?: (session: ClickToEditBlockEditSession | null) => void;
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
  onConfirmRemove,
  onCancelRemove,
  isDeletePending = false,
  onDuplicate,
  onMove,
  canMoveUp,
  canMoveDown,
  isGenerating = false,
  campaignName,
  allBlocks = [],
  retryImageGeneration,
  onOpenAIImageDialog,
  onRequestOpenEditor,
  onEditSessionChange,
  children,
}) => {
  const [localBlock, setLocalBlock] = useState<ContentBlock>(block);
  const [collapsed, setCollapsed] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<HTMLDivElement>(null);
  const imageEditSnapshotRef = useRef<ContentBlock | null>(null);
  const wasEditingRef = useRef(false);
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<"buttonUrl" | "imageUrl", string>>
  >({});
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [isOverlayDialogOpen, setIsOverlayDialogOpen] = useState(false);
  const [isGridConfigOpen, setIsGridConfigOpen] = useState(false);

  // Drag-to-reorder via @dnd-kit/sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 999 : ("auto" as any),
  };

  // Use the new edit mode hook
  const {
    editMode,
    setEditMode,
    toggleMode,
    exitEditMode,
    isTextEditing,
    isImageEditing,
    isFormatEditing,
  } = useBlockEditMode();

  // AI Image Generation hook
  const { generateSingleImage } = useAIImageGeneration();
  const { toast } = useToast();

  // Sync local state with props when block changes from parent
  useEffect(() => {
    setLocalBlock(block);
  }, [block]);

  useEffect(() => {
    setValidationErrors({});
  }, [block.id]);

  useEffect(() => {
    if (editMode === null) {
      imageEditSnapshotRef.current = null;
    }
  }, [editMode]);

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
    [block.id, onUpdate],
  );

  // Handle immediate local updates with content sanitization
  const handleLocalUpdate = useCallback(
    (updates: Partial<ContentBlock>) => {
      // Sanitize text content automatically
      const sanitizedUpdates = { ...updates };
      if (updates.content && typeof updates.content === "string") {
        sanitizedUpdates.content = sanitizeAndImproveContent(updates.content);
      }
      if (updates.title && typeof updates.title === "string") {
        sanitizedUpdates.title = sanitizeAndImproveContent(updates.title);
      }
      if (updates.headline && typeof updates.headline === "string") {
        sanitizedUpdates.headline = sanitizeAndImproveContent(updates.headline);
      }

      if (
        "buttonUrl" in sanitizedUpdates ||
        "ctaUrl" in sanitizedUpdates ||
        "buttonText" in sanitizedUpdates ||
        "ctaText" in sanitizedUpdates
      ) {
        setValidationErrors((current) => ({
          ...current,
          buttonUrl: undefined,
        }));
      }

      if ("imageUrl" in sanitizedUpdates) {
        setValidationErrors((current) => ({
          ...current,
          imageUrl: undefined,
        }));
      }

      const updatedBlock = { ...localBlock, ...sanitizedUpdates };
      setLocalBlock(updatedBlock);
      // Update parent immediately for all content changes
      onUpdate(block.id, sanitizedUpdates);
    },
    [localBlock, block.id, onUpdate],
  );

  const commitBlockChanges = useCallback(() => {
    const validation = validateBlockBeforeSave(localBlock);
    setValidationErrors(validation.fieldErrors);

    if (!validation.isValid) {
      return false;
    }

    setLocalBlock(validation.sanitizedBlock);
    onUpdate(block.id, validation.sanitizedBlock);
    setValidationErrors({});
    exitEditMode();
    return true;
  }, [block.id, exitEditMode, localBlock, onUpdate]);

  const discardBlockChanges = useCallback(() => {
    const originalBlock = imageEditSnapshotRef.current;
    if (originalBlock) {
      setLocalBlock(originalBlock);
      onUpdate(block.id, originalBlock);
    }
    setValidationErrors({});
    exitEditMode();
  }, [block.id, exitEditMode, onUpdate]);

  const cancelBlockEditing = useCallback(() => {
    setValidationErrors({});
    exitEditMode();
  }, [exitEditMode]);

  const requestEditorOpen = useCallback(
    (openEditor: () => void) => {
      if (onRequestOpenEditor) {
        onRequestOpenEditor(block.id, openEditor);
        return;
      }

      openEditor();
    },
    [block.id, onRequestOpenEditor],
  );

  const isDirty =
    editMode !== null && imageEditSnapshotRef.current
      ? !areBlocksEqual(localBlock, imageEditSnapshotRef.current)
      : false;

  useEffect(() => {
    if (!onEditSessionChange) return;

    if (!editMode) {
      if (wasEditingRef.current) {
        wasEditingRef.current = false;
        onEditSessionChange(null);
      }
      return;
    }

    wasEditingRef.current = true;

    onEditSessionChange({
      blockId: block.id,
      blockLabel: getBlockDisplayLabel(block, index),
      isDirty,
      save: commitBlockChanges,
      discard: discardBlockChanges,
      cancel: cancelBlockEditing,
    });
  }, [
    block,
    block.id,
    cancelBlockEditing,
    commitBlockChanges,
    discardBlockChanges,
    editMode,
    index,
    isDirty,
    onEditSessionChange,
  ]);

  // Strengthen content function for weak blocks
  const handleStrengthenContent = async () => {
    try {
      const contentToImprove =
        block.content || block.title || block.headline || "";
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
      console.error("Error strengthening content:", error);
    }
  };

  // Register/unregister media selector with overlay registry
  useEffect(() => {
    if (isMediaSelectorOpen) {
      registerEditOverlay("media-selector");
    } else {
      unregisterEditOverlay("media-selector");
    }
    return () => {
      unregisterEditOverlay("media-selector");
    };
  }, [isMediaSelectorOpen]);

  // Helper to check if click/focus is inside an allowed editing overlay (DOM fallback)
  const isInsideAllowedOverlay = (target: HTMLElement | null): boolean => {
    if (!target) return false;

    // MediaSelector sidebar/modal
    const mediaSelector = document.querySelector(
      "[data-media-selector-sidebar]",
    );
    if (mediaSelector && mediaSelector.contains(target)) return true;

    // MergeTagPicker popover (explicit data attribute)
    if (target.closest('[data-merge-tag-picker="true"]')) return true;

    // Generic allowlist for any future editing overlays
    if (target.closest('[data-click-to-edit-allowed-overlay="true"]'))
      return true;

    // Also check the overlay-root wrapper from popover.tsx
    if (target.closest("[data-overlay-root]")) return true;

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
      cancelBlockEditing();
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

      cancelBlockEditing();
    };

    // Handle Escape key to exit edit mode when no overlays are active
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Let overlays handle Escape first (Radix will close popover)
        // Only exit edit mode if no overlays are active after a small delay
        setTimeout(() => {
          if (!hasActiveEditOverlays()) {
            cancelBlockEditing();
          }
        }, 50);
      }
    };

    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [cancelBlockEditing, editMode]);

  // Handle mode changes with special logic for image mode
  const handleModeChange = (mode: EditMode) => {
    if (mode === "image") {
      if (GALLERY_BLOCK_TYPES.has(block.type)) {
        if (editMode === "image") {
          cancelBlockEditing();
          return;
        }

        requestEditorOpen(() => {
          if (!editMode) {
            imageEditSnapshotRef.current = cloneContentBlock(localBlock);
          }
          setValidationErrors({});
          setEditMode("image");
        });
        return;
      }

      // For header blocks, image mode should show the full editor interface
      if (block.type === "header") {
        requestEditorOpen(() => {
          if (!editMode) {
            imageEditSnapshotRef.current = cloneContentBlock(localBlock);
          }
          setValidationErrors({});
          setEditMode("image");
        });
        return;
      }

      requestEditorOpen(() => {
        if (!editMode) {
          imageEditSnapshotRef.current = cloneContentBlock(localBlock);
        }
        setValidationErrors({});
        setIsMediaSelectorOpen(true);
        setEditMode("image");
      });
      return;
    }

    if (!mode) {
      cancelBlockEditing();
      return;
    }

    if (editMode === mode) {
      cancelBlockEditing();
      return;
    }

    requestEditorOpen(() => {
      if (!editMode) {
        imageEditSnapshotRef.current = cloneContentBlock(localBlock);
      }
      setValidationErrors({});
      setEditMode(mode);
    });
  };

  // Create local edit mode for contextual components
  const localEditMode = editMode;

  // Handle image selection from MediaSelector
  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    // For newsletter headers, update backgroundImageUrl instead of imageUrl
    if (block.type === "newsletter-header") {
      handleLocalUpdate({
        backgroundImageUrl: imageUrl,
        altText: metadata?.alt || metadata?.description || block.altText,
      });
    } else {
      handleLocalUpdate({
        imageUrl,
        altText: metadata?.alt || metadata?.description || block.altText,
      });
    }
    setIsMediaSelectorOpen(false);
  };

  const handleBlockClick = () => {
    // Expand if collapsed before entering edit mode
    if (collapsed) {
      setCollapsed(false);
      return;
    }
    if (!editMode) {
      if (GALLERY_BLOCK_TYPES.has(block.type)) {
        requestEditorOpen(() => {
          imageEditSnapshotRef.current = cloneContentBlock(localBlock);
          setValidationErrors({});
          setEditMode("image");
        });
        return;
      }

      // Don't show text edit mode for image-only blocks (full-width images, graphic-hero)
      // These blocks don't have text content to edit
      const isImageOnlyBlock =
        block.type === "graphic-hero" ||
        (block.type === "image" && block.layout === "full-width") ||
        (block.type === "image" &&
          !block.content &&
          !block.title &&
          !block.headline &&
          !block.body);

      if (isImageOnlyBlock) {
        return;
      }
      requestEditorOpen(() => {
        imageEditSnapshotRef.current = cloneContentBlock(localBlock);
        setValidationErrors({});
        setEditMode("text");
      });
    }
  };

  // Auto Pick Image Handler - generates image based on block content or seasonal fallback
  const handleAutoPickImage = async () => {
    try {
      // Check if block has any content
      const blockContent =
        block.title || block.headline || block.body || block.content;

      // Determine the content context for image generation
      let contentContext: string;
      let contentTitle: string | undefined;

      if (blockContent && blockContent.trim()) {
        // Use existing block content as context
        contentContext = blockContent;
        contentTitle = block.title || block.headline || undefined;
      } else {
        // Fallback to seasonal garden imagery
        const currentMonth = new Date().getMonth();
        let season = "spring";
        if (currentMonth >= 2 && currentMonth <= 4) season = "spring";
        else if (currentMonth >= 5 && currentMonth <= 7) season = "summer";
        else if (currentMonth >= 8 && currentMonth <= 10) season = "fall";
        else season = "winter";

        contentContext = `Beautiful ${season} garden with flowers, plants, and lush greenery. Garden center atmosphere with vibrant blooms and foliage.`;
        contentTitle = `${season.charAt(0).toUpperCase() + season.slice(1)} Garden`;
      }

      // Set loading state
      handleLocalUpdate({
        isGeneratingImage: true,
        imageGenerationError: undefined,
      });

      // Generate the image
      const imageUrl = await generateSingleImage({
        contentContext,
        contentTitle,
        channel: "newsletter",
        uploadToStorage: true,
      });

      if (imageUrl) {
        // Update the block with the generated image
        if (block.type === "newsletter-header") {
          handleLocalUpdate({
            backgroundImageUrl: imageUrl,
            isGeneratingImage: false,
            imageGenerationError: undefined,
          });
        } else {
          handleLocalUpdate({
            imageUrl,
            isGeneratingImage: false,
            imageGenerationError: undefined,
          });
        }

        toast({
          title: "Image generated!",
          description: "AI image has been added to your block.",
        });
      } else {
        throw new Error("Failed to generate image");
      }
    } catch (error: any) {
      console.error("❌ Auto Pick image generation failed:", error);
      handleLocalUpdate({
        isGeneratingImage: false,
        imageGenerationError: error.message || "Failed to generate image",
      });

      toast({
        title: "Image generation failed",
        description: "Please try again or select an image manually.",
        variant: "destructive",
      });
    }
  };

  const isAnyEditMode = isTextEditing || isImageEditing || isFormatEditing;

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={cn(
        "group relative click-to-edit-container",
        isAnyEditMode && "click-to-edit-editing",
      )}
    >
      {/* Collapse toggle + Drag Handle — left gutter */}
      <div className="absolute -left-8 top-3 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
          title={collapsed ? "Expand block" : "Collapse block"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Tools Dropdown Menu - unified toolbar for all block actions */}
      {block.type !== "header" && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
          <ToolsDropdownMenu
            block={localBlock}
            editMode={editMode}
            onModeChange={handleModeChange}
            onAutoPickImage={handleAutoPickImage}
            onOpenAIImageDialog={
              onOpenAIImageDialog
                ? () => onOpenAIImageDialog(block.id)
                : undefined
            }
            onOpenGridConfig={
              block.type === "image-gallery"
                ? () => setIsGridConfigOpen(true)
                : undefined
            }
            onOpenOverlayDialog={
              block.type === "newsletter-header" &&
              (block.imageUrl || block.backgroundImageUrl)
                ? () => setIsOverlayDialogOpen(true)
                : undefined
            }
            onStrengthenContent={(() => {
              const contentToCheck =
                block.content || block.title || block.headline || "";
              const quality = assessContentQuality(contentToCheck, "body");
              return contentToCheck &&
                (quality.level === "poor" || quality.level === "fair")
                ? handleStrengthenContent
                : undefined;
            })()}
            onDelete={() => onRemove(block.id)}
            disabled={block.isGeneratingImage}
          />
        </div>
      )}

      {/* Inline delete confirmation bar */}
      {isDeletePending && (
        <div
          className="absolute top-0 left-0 right-0 z-[60] flex items-center justify-between gap-2 rounded-t-lg border-b bg-destructive/5 px-4 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-sm font-medium text-destructive flex items-center gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Delete this block?
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => onCancelRemove?.()}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => onConfirmRemove?.(block.id)}
            >
              Yes, delete
            </Button>
          </div>
        </div>
      )}

      <Card
        ref={blockRef}
        className={cn(
          "transition-all duration-200 click-to-edit-block relative",
          isAnyEditMode
            ? "shadow-md ring-2 ring-primary/20"
            : "hover:shadow-sm",
          block.visible === false && "opacity-60",
          isGenerating && "bg-accent/10",
        )}
        style={{
          pointerEvents: "auto",
          overflow: "visible",
          backgroundColor: "#ffffff",
        }}
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
                  validationErrors={validationErrors}
                  onSave={commitBlockChanges}
                  onCancel={discardBlockChanges}
                />
              </div>
            )}

            {/* Image Edit Mode */}
            {isImageEditing && (
              <div className="p-4">
                {React.cloneElement(children.editor as React.ReactElement, {
                  block: localBlock,
                  onUpdate: handleLocalUpdate,
                  validationErrors,
                  onClose: commitBlockChanges,
                  onCancel: discardBlockChanges,
                  isPreview: false,
                  editMode: "image",
                  onModeChange: handleModeChange,
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
                    onOpenAIImageDialog,
                  })
                ) : typeof children.preview === "object" &&
                  children.preview !== null ? (
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
                    onOpenAIImageDialog,
                  })
                ) : typeof children.preview === "object" &&
                  children.preview !== null ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Error: Cannot render block object directly
                  </div>
                ) : (
                  children.preview
                )}
              </div>
            )}
          </div>
        ) : collapsed ? (
          /* ── Collapsed: mini-preview ── */
          <div
            className="cursor-pointer"
            onClick={() => setCollapsed(false)}
            style={{ pointerEvents: "auto" }}
          >
            <BlockMiniPreview block={localBlock} />
          </div>
        ) : (
          /* ── Expanded: full preview ── */
          <div
            className="p-0 cursor-pointer"
            onClick={handleBlockClick}
            style={{ pointerEvents: "auto" }}
          >
            {(() => {
              try {
                if (React.isValidElement(children.preview)) {
                  return React.cloneElement(
                    children.preview as React.ReactElement,
                    {
                      block: localBlock,
                      editMode: localEditMode,
                      onModeChange: handleModeChange,
                      onOpenAIImageDialog,
                    },
                  );
                } else if (
                  typeof children.preview === "object" &&
                  children.preview !== null
                ) {
                  console.error(
                    "[ClickToEditBlock] Invalid preview object:",
                    children.preview,
                  );
                  return (
                    <div className="p-4 text-center text-red-500 border border-red-200 rounded">
                      Error: Invalid preview content (object detected)
                    </div>
                  );
                } else {
                  return children.preview;
                }
              } catch (error) {
                console.error(
                  "[ClickToEditBlock] Error rendering preview:",
                  error,
                );
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
      {isMediaSelectorOpen && (
        <MediaSelectorSidebar
          isOpen={isMediaSelectorOpen}
          editMode="image"
          onClose={() => {
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
            galleryLayout: "custom",
            galleryRows: rows,
            galleryColumns: columns,
          } as any);
        }}
      />
    </div>
  );
};
