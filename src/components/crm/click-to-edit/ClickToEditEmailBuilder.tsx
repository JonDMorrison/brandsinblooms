import React, { useState, useEffect, useCallback, useRef } from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { Button } from "@/components/ui-legacy/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Plus, Bug } from "lucide-react";
import {
  ClickToEditBlock,
  type ClickToEditBlockEditSession,
} from "./ClickToEditBlock";
import { HeaderBlock } from "./blocks/HeaderBlock";
import { NewsletterHeaderBlock } from "./blocks/NewsletterHeaderBlock";
import { EmailSafeHeroBlock } from "./blocks/EmailSafeHeroBlock";
import { GraphicHeroBlock } from "./blocks/GraphicHeroBlock";
import { TextBlock } from "./blocks/TextBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { ImageTextBlock } from "./blocks/ImageTextBlock";
import { DividerBlock } from "./blocks/DividerBlock";
import { ButtonBlock } from "./blocks/ButtonBlock";
import { SocialFollowBlock } from "./blocks/SocialFollowBlock";
import { FooterBlock } from "./blocks/FooterBlock";
import { ImageGalleryBlock } from "./blocks/ImageGalleryBlock";
import { ProductGalleryBlock } from "./blocks/ProductGalleryBlock";
import { MediaSelectorSidebar } from "@/components/crm/MediaSelectorSidebar";
import { useFooterSettings } from "@/hooks/useFooterSettings";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { SaveIndicator } from "@/components/crm/SaveIndicator";
import { useHeaderBackgroundImage } from "@/hooks/useHeaderBackgroundImage";
import { trackImageUsage } from "@/lib/imageUsageTracking";

interface ClickToEditEmailBuilderProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
  onOpenAddModal?: (afterIndex?: number) => void;
  generatingBlocks?: Set<string>;
  campaignName?: string;
  campaignId?: string;
  onOpenAIImageDialog?: (blockId: string) => void;
  footerBackgroundColor?: string;
  onFooterColorChange?: (color: string | undefined) => void;
  onFooterStylingChange?: (
    styling: import("@/types/footerStyling").FooterStyling,
  ) => void;
  onEditSessionChange?: (session: ClickToEditBlockEditSession | null) => void;
}

function normalizeBuilderRenderableBlock(block: ContentBlock): ContentBlock {
  switch (block.type) {
    case "cta": {
      return {
        ...block,
        type: "button",
        headline: block.headline || block.title || block.heading || "",
        title: block.title || block.headline || block.heading || "",
        body:
          block.body ||
          (typeof block.content === "string" ? block.content : "") ||
          "",
        content:
          (typeof block.content === "string" ? block.content : block.body) ||
          "",
        buttonText: block.buttonText || block.ctaText || "",
        buttonUrl: block.buttonUrl || block.ctaUrl || "",
        ctaText: block.ctaText || block.buttonText || "",
        ctaUrl: block.ctaUrl || block.buttonUrl || "",
        textAlign: block.textAlign || block.alignment || "center",
        alignment: block.alignment || block.textAlign || "center",
      };
    }
    case "quote": {
      const quoteBody =
        block.quote ||
        block.body ||
        (typeof block.content === "string" ? block.content : "") ||
        "";

      return {
        ...block,
        type: "text",
        headline: block.headline || block.title || "",
        title: block.title || block.headline || "",
        body: quoteBody,
        content: quoteBody,
        textAlign: block.textAlign || block.alignment || "center",
        alignment: block.alignment || block.textAlign || "center",
      };
    }
    case "product": {
      const buttonUrl = block.buttonUrl || block.ctaUrl || "";

      return {
        ...block,
        type: "image-text",
        headline: block.headline || block.title || "",
        title: block.title || block.headline || "",
        body:
          block.body ||
          (typeof block.content === "string" ? block.content : "") ||
          "",
        content:
          (typeof block.content === "string" ? block.content : block.body) ||
          "",
        imageUrl: block.imageUrl || block.backgroundImageUrl || "",
        altText:
          block.altText || block.title || block.headline || "Product image",
        buttonText:
          block.buttonText ||
          block.ctaText ||
          (buttonUrl ? "View Product" : ""),
        buttonUrl,
        ctaText:
          block.ctaText ||
          block.buttonText ||
          (buttonUrl ? "View Product" : ""),
        ctaUrl: block.ctaUrl || block.buttonUrl || "",
        layout: block.layout || "image-left",
        textAlign: block.textAlign || block.alignment || "left",
        alignment: block.alignment || block.textAlign || "left",
      };
    }
    default:
      return block;
  }
}

function normalizeBuilderBlockUpdates(
  originalBlock: ContentBlock,
  updates: Partial<ContentBlock>,
): Partial<ContentBlock> {
  const nextUpdates: Partial<ContentBlock> = { ...updates };

  if (typeof updates.headline === "string" && updates.title === undefined) {
    nextUpdates.title = updates.headline;
  }

  if (typeof updates.body === "string" && updates.content === undefined) {
    nextUpdates.content = updates.body;
  }

  if (
    typeof updates.buttonText === "string" &&
    updates.ctaText === undefined
  ) {
    nextUpdates.ctaText = updates.buttonText;
  }

  if (typeof updates.buttonUrl === "string" && updates.ctaUrl === undefined) {
    nextUpdates.ctaUrl = updates.buttonUrl;
  }

  switch (originalBlock.type) {
    case "quote": {
      const quoteValue =
        typeof updates.body === "string"
          ? updates.body
          : typeof updates.content === "string"
            ? updates.content
            : undefined;

      if (quoteValue !== undefined) {
        nextUpdates.quote = quoteValue;
      }
      break;
    }
    case "product": {
      if (
        typeof updates.buttonText === "string" &&
        updates.ctaText === undefined
      ) {
        nextUpdates.ctaText = updates.buttonText;
      }

      if (
        typeof updates.buttonUrl === "string" &&
        updates.ctaUrl === undefined
      ) {
        nextUpdates.ctaUrl = updates.buttonUrl;
      }
      break;
    }
    default:
      break;
  }

  return nextUpdates;
}

export const ClickToEditEmailBuilder: React.FC<
  ClickToEditEmailBuilderProps
> = ({
  blocks,
  onBlocksChange,
  onOpenAddModal,
  generatingBlocks = new Set(),
  campaignName,
  campaignId,
  onOpenAIImageDialog,
  footerBackgroundColor,
  onFooterColorChange,
  onFooterStylingChange,
  onEditSessionChange,
}) => {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>();
  const [saveError, setSaveError] = useState(false);
  const [activeEditSession, setActiveEditSession] =
    useState<ClickToEditBlockEditSession | null>(null);
  const [editResolutionOpen, setEditResolutionOpen] = useState(false);
  const [pendingEditorContinuation, setPendingEditorContinuation] = useState<
    (() => void) | null
  >(null);

  // Debug state for MediaSelector
  const [debugMediaSelectorOpen, setDebugMediaSelectorOpen] = useState(false);

  // PHASE 2: Use ref to access latest blocks in updateBlock
  const blocksRef = useRef(blocks);

  // Keep ref in sync with blocks
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    onEditSessionChange?.(activeEditSession);
  }, [activeEditSession, onEditSessionChange]);

  const closeEditResolutionDialog = useCallback(() => {
    setEditResolutionOpen(false);
    setPendingEditorContinuation(null);
  }, []);

  const continueAfterResolution = useCallback(() => {
    const continuation = pendingEditorContinuation;
    closeEditResolutionDialog();
    continuation?.();
  }, [closeEditResolutionDialog, pendingEditorContinuation]);

  const requestEditorResolution = useCallback(
    (continuation: () => void) => {
      if (!activeEditSession) {
        continuation();
        return;
      }

      if (!activeEditSession.isDirty) {
        activeEditSession.cancel();
        continuation();
        return;
      }

      setPendingEditorContinuation(() => continuation);
      setEditResolutionOpen(true);
    },
    [activeEditSession],
  );

  const handleRequestOpenEditor = useCallback(
    (blockId: string, openEditor: () => void) => {
      if (!activeEditSession || activeEditSession.blockId === blockId) {
        openEditor();
        return;
      }

      requestEditorResolution(openEditor);
    },
    [activeEditSession, requestEditorResolution],
  );

  // Find the first header block (header or newsletter-header)
  const headerBlock = blocks.find(
    (b) => b.type === "header" || b.type === "newsletter-header",
  );

  // Use header background image generation hook
  const { isGenerating: isGeneratingHeaderImage } = useHeaderBackgroundImage({
    blocks: blocks.map((b) => ({
      type: b.type,
      content: {
        title: b.title || b.headline,
        subtitle: b.subtitle || b.body,
        content: b.content,
        text: typeof b.content === "string" ? b.content : undefined,
      },
      isGenerating: generatingBlocks.has(b.id),
      backgroundImageUrl: b.backgroundImageUrl,
    })),
    campaignTitle: campaignName || "Newsletter",
    onImageReady: (imageUrl, metadata) => {
      if (headerBlock) {
        const updates: Partial<ContentBlock> = {
          backgroundImageUrl: imageUrl,
          // Set a subtle dark overlay for better text readability (using dark green instead of black)
          backgroundColor: "#1f2937",
          colorOverlayOpacity: 40,
          backgroundOpacity: 60,
        };

        // Set the generated subtitle if available
        if (metadata?.generatedSubtitle) {
          updates.body = metadata.generatedSubtitle;
        }

        updateBlock(headerBlock.id, updates);

        // Track image usage if globalImageId is available
        if (metadata?.globalImageId) {
          trackImageUsage({
            globalImageId: metadata.globalImageId,
            context: "header_block",
            blockId: headerBlock.id,
          });
        }
      }
    },
    enabled: !!headerBlock && !headerBlock.backgroundImageUrl, // Only generate if no image exists
  });

  // Create a dummy footer block for display (not included in the actual blocks array)
  const footerBlock: ContentBlock = {
    id: "email-footer",
    type: "footer",
    source: "manual",
    visible: true,
    collapsed: false,
    textAlign: "center",
    padding: "medium",
  };

  // Auto-save to localStorage with debouncing
  const debouncedSave = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (blocksToSave: ContentBlock[]) => {
        clearTimeout(timeoutId);
        setSaving(true);
        setSaveError(false);

        timeoutId = setTimeout(() => {
          try {
            localStorage.setItem(
              "emailBuilder_draft",
              JSON.stringify({
                blocks: blocksToSave,
                timestamp: Date.now(),
              }),
            );
            setLastSaved(new Date());
            setSaveError(false);
            setSaveError(true);
          } finally {
            setSaving(false);
          }
        }, 500);
      };
    })(),
    [],
  );

  // Auto-save whenever blocks change
  useEffect(() => {
    if (blocks.length > 0) {
      debouncedSave(blocks);
    }
  }, [blocks, debouncedSave]);
  const createBlock = (
    type: ContentBlock["type"],
    afterIndex?: number,
  ): ContentBlock => {
    const id = `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const baseBlock: ContentBlock = {
      id,
      type,
      source: "manual",
      visible: true,
      collapsed: false,
      layout: type === "image-text" ? "image-right" : undefined,
      textAlign: "left",
      padding: "medium",
    };

    return baseBlock;
  };

  const addBlock = (type: ContentBlock["type"], afterIndex?: number) => {
    const newBlock = createBlock(type);
    const newBlocks = [...blocks];

    if (afterIndex !== undefined) {
      newBlocks.splice(afterIndex + 1, 0, newBlock);
    } else {
      newBlocks.push(newBlock);
    }

    onBlocksChange(newBlocks);
  };

  // PHASE 2: Fix state update race condition - use ref to access latest blocks
  const updateBlock = useCallback(
    (id: string, updates: Partial<ContentBlock>) => {
      // Use ref to get the latest blocks (avoiding stale closure)
      const latestBlocks = blocksRef.current;
      const newBlocks = latestBlocks.map((block) => {
        if (block.id !== id) return block;

        // Merge updates and preserve content generation flags
        const updatedBlock: ContentBlock = {
          ...block,
          ...updates,
          // Preserve content generation flags from previous state
          hasGeneratedContent:
            (block as any).hasGeneratedContent ||
            (updates as any).hasGeneratedContent,
          contentGeneratedAt:
            (block as any).contentGeneratedAt ||
            (updates as any).contentGeneratedAt,
          contentVersion:
            (block as any).contentVersion || (updates as any).contentVersion,
        };

        return updatedBlock;
      });

      onBlocksChange(newBlocks);
    },
    [onBlocksChange],
  );

  const removeBlock = (id: string) => {
    const filteredBlocks = blocks.filter((block) => block.id !== id);
    onBlocksChange(filteredBlocks);
  };

  const duplicateBlock = (block: ContentBlock) => {
    const newBlock = {
      ...block,
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    const blockIndex = blocks.findIndex((b) => b.id === block.id);
    const newBlocks = [...blocks];
    newBlocks.splice(blockIndex + 1, 0, newBlock);
    onBlocksChange(newBlocks);
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    const currentIndex = blocks.findIndex((block) => block.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    const [movedBlock] = newBlocks.splice(currentIndex, 1);
    newBlocks.splice(newIndex, 0, movedBlock);
    onBlocksChange(newBlocks);
  };

  const renderBlock = (block: ContentBlock) => {
    const renderableBlock = normalizeBuilderRenderableBlock(block);
    const props = {
      block: renderableBlock,
      onUpdate: (updates: Partial<ContentBlock>) =>
        updateBlock(block.id, normalizeBuilderBlockUpdates(block, updates)),
    };

    const isHeaderGeneratingImage =
      (renderableBlock.type === "header" ||
        renderableBlock.type === "newsletter-header") &&
      (isGeneratingHeaderImage ||
        (renderableBlock as any).isGeneratingImage === true);

    switch (renderableBlock.type) {
      case "header":
        return (
          <HeaderBlock
            {...props}
            isPreview={false}
            isGeneratingImage={isHeaderGeneratingImage}
          />
        );
      case "newsletter-header":
        return (
          <NewsletterHeaderBlock
            {...props}
            isPreview={false}
            isGeneratingImage={isHeaderGeneratingImage}
          />
        );
      case "email-safe-hero":
        return (
          <EmailSafeHeroBlock
            {...props}
            isPreview={false}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "graphic-hero":
        return (
          <GraphicHeroBlock
            {...props}
            isPreview={false}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "text":
        // Use ImageTextBlock for text blocks that have images, image-centric layouts, or headlines
        const hasImageLayout =
          block.layout &&
          [
            "two-column-left",
            "two-column-right",
            "image-left",
            "image-right",
          ].includes(block.layout);
        // Only render as image-text if there's an actual image OR an explicit image layout was chosen
        if (block.imageUrl || hasImageLayout) {
          return (
            <ImageTextBlock
              {...props}
              isPreview={false}
              isGenerating={generatingBlocks.has(block.id)}
            />
          );
        }
        return <TextBlock {...props} isPreview={false} />;
      case "image":
        // Use ImageTextBlock for image blocks with two-column layouts
        const hasTwoColumnLayout =
          block.layout &&
          ["two-column-left", "two-column-right"].includes(block.layout);
        if (hasTwoColumnLayout) {
          return (
            <ImageTextBlock
              {...props}
              isPreview={false}
              isGenerating={generatingBlocks.has(block.id)}
            />
          );
        }
        return (
          <ImageBlock
            {...props}
            isPreview={false}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "image-text":
        return (
          <ImageTextBlock
            {...props}
            isPreview={false}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "divider":
        return <DividerBlock {...props} isPreview={false} />;
      case "button":
        return <ButtonBlock {...props} isPreview={false} />;
      case "social-follow":
        return <SocialFollowBlock {...props} isPreview={false} />;
      case "footer":
        return (
          <FooterBlock
            {...props}
            isPreview={false}
            campaignId={campaignId}
            footerBackgroundColor={footerBackgroundColor}
            onFooterColorChange={onFooterColorChange}
            onFooterStylingChange={onFooterStylingChange}
          />
        );
      case "image-gallery":
        return (
          <ImageGalleryBlock
            {...props}
            isPreview={false}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "product-gallery":
        return (
          <ProductGalleryBlock
            {...props}
            isPreview={false}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      default:
        return <div>{`Unknown block type: ${block.type}`}</div>;
    }
  };

  const renderBlockPreview = (block: ContentBlock) => {
    const renderableBlock = normalizeBuilderRenderableBlock(block);
    const props = {
      block: renderableBlock,
      onUpdate: (updates: Partial<ContentBlock>) =>
        updateBlock(block.id, normalizeBuilderBlockUpdates(block, updates)),
    };

    const isHeaderGeneratingImage =
      (renderableBlock.type === "header" ||
        renderableBlock.type === "newsletter-header") &&
      (isGeneratingHeaderImage ||
        (renderableBlock as any).isGeneratingImage === true);

    switch (renderableBlock.type) {
      case "header":
        return (
          <HeaderBlock
            {...props}
            isPreview={true}
            isGeneratingImage={isHeaderGeneratingImage}
          />
        );
      case "newsletter-header":
        return (
          <NewsletterHeaderBlock
            {...props}
            isPreview={true}
            isGeneratingImage={isHeaderGeneratingImage}
          />
        );
      case "email-safe-hero":
        return (
          <EmailSafeHeroBlock
            {...props}
            isPreview={true}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "graphic-hero":
        return (
          <GraphicHeroBlock
            {...props}
            isPreview={true}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "text":
        // Use ImageTextBlock for text blocks that have images, image-centric layouts, or headlines
        const hasImageLayout =
          block.layout &&
          [
            "two-column-left",
            "two-column-right",
            "image-left",
            "image-right",
          ].includes(block.layout);
        // Only render as image-text if there's an actual image OR an explicit image layout was chosen
        if (block.imageUrl || hasImageLayout) {
          return (
            <ImageTextBlock
              {...props}
              isPreview={true}
              isGenerating={generatingBlocks.has(block.id)}
            />
          );
        }
        return <TextBlock {...props} isPreview={true} />;
      case "image":
        // Use ImageTextBlock for image blocks with two-column layouts
        const hasTwoColumnLayoutPreview =
          block.layout &&
          ["two-column-left", "two-column-right"].includes(block.layout);
        if (hasTwoColumnLayoutPreview) {
          return (
            <ImageTextBlock
              {...props}
              isPreview={true}
              isGenerating={generatingBlocks.has(block.id)}
            />
          );
        }
        return (
          <ImageBlock
            {...props}
            isPreview={true}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "image-text":
        return (
          <ImageTextBlock
            {...props}
            isPreview={true}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "divider":
        return <DividerBlock {...props} isPreview={true} />;
      case "button":
        return <ButtonBlock {...props} isPreview={true} />;
      case "social-follow":
        return <SocialFollowBlock {...props} isPreview={true} />;
      case "footer":
        return (
          <FooterBlock
            {...props}
            isPreview={true}
            campaignId={campaignId}
            footerBackgroundColor={footerBackgroundColor}
            onFooterColorChange={onFooterColorChange}
            onFooterStylingChange={onFooterStylingChange}
          />
        );
      case "image-gallery":
        return (
          <ImageGalleryBlock
            {...props}
            isPreview={true}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      case "product-gallery":
        return (
          <ProductGalleryBlock
            {...props}
            isPreview={true}
            isGenerating={generatingBlocks.has(block.id)}
          />
        );
      default:
        return <div>{`Unknown block type: ${block.type}`}</div>;
    }
  };

  const AddBlockButton: React.FC<{ afterIndex?: number }> = ({
    afterIndex,
  }) => {
    const handleAddBlock = () => {
      if (onOpenAddModal) {
        requestEditorResolution(() => onOpenAddModal(afterIndex));
      }
    };

    return (
      <div className="flex justify-center py-4">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-background hover:bg-accent"
          onClick={handleAddBlock}
        >
          <Plus className="h-4 w-4" />
          Add Block
        </Button>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-2">
      {/* Add block button at top */}
      <AddBlockButton afterIndex={-1} />

      {/* Render all blocks */}
      {blocks.map((block, index) => (
        <div key={block.id}>
          <ClickToEditBlock
            block={block}
            index={index}
            onUpdate={updateBlock}
            campaignName={campaignName}
            onRemove={removeBlock}
            onDuplicate={duplicateBlock}
            onMove={moveBlock}
            canMoveUp={index > 0}
            canMoveDown={index < blocks.length - 1}
            isGenerating={generatingBlocks.has(block.id)}
            allBlocks={blocks}
            onOpenAIImageDialog={onOpenAIImageDialog}
            onRequestOpenEditor={handleRequestOpenEditor}
            onEditSessionChange={setActiveEditSession}
          >
            {{
              preview: renderBlockPreview(block),
              editor: renderBlock(block),
            }}
          </ClickToEditBlock>

          {/* Add block button between blocks */}
          <AddBlockButton afterIndex={index} />
        </div>
      ))}

      {/* Empty state */}
      {blocks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-6xl mb-4">📧</div>
          <h3 className="text-lg font-medium mb-2">
            Start building your email
          </h3>
          <p className="text-sm mb-4">
            Add your first content block to get started
          </p>
        </div>
      )}

      {/* Auto-included Footer (always at bottom, cannot be deleted) */}
      <div className="border-t-2 border-dashed border-gray-300 mt-8 pt-4">
        <div className="text-center text-sm text-muted-foreground mb-2 uppercase tracking-wide">
          📧 Auto-Included Email Footer
        </div>
        <FooterBlock
          block={footerBlock}
          onUpdate={() => {}} // Footer settings managed separately
          isPreview={true}
          campaignId={campaignId}
          footerBackgroundColor={footerBackgroundColor}
          onFooterColorChange={onFooterColorChange}
        />
      </div>

      {/* Debug MediaSelector */}
      {debugMediaSelectorOpen && (
        <MediaSelectorSidebar
          isOpen={debugMediaSelectorOpen}
          onClose={() => {
            setDebugMediaSelectorOpen(false);
          }}
          onImageSelect={() => {
            setDebugMediaSelectorOpen(false);
          }}
          contentContext="Debug test"
        />
      )}

      <Dialog
        open={editResolutionOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditResolutionDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved block edits</DialogTitle>
            <DialogDescription>
              {activeEditSession
                ? `${activeEditSession.blockLabel} has unsaved changes.`
                : "Finish the current block before continuing."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={closeEditResolutionDialog}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  activeEditSession?.discard();
                  continueAfterResolution();
                }}
              >
                Discard & Continue
              </Button>
              <Button
                onClick={() => {
                  const saved = activeEditSession?.save() ?? true;
                  if (saved !== false) {
                    continueAfterResolution();
                  }
                }}
              >
                Save & Continue
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
