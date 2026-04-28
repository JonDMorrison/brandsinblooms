import React, { useState, useEffect } from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { Card, CardContent } from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { Plus } from "lucide-react";
import { ClickToEditEmailBuilder } from "./click-to-edit/ClickToEditEmailBuilder";
import { FooterBlock } from "./click-to-edit/blocks/FooterBlock";
import { BlockLayoutModal, LayoutType } from "./BlockLayoutModal";
import { mediaSelector } from "@/utils/mediaSelector";
import { RegenerateBlockButton } from "./RegenerateBlockButton";
import { NextBlockSuggestion } from "./NextBlockSuggestion";
import type { ClickToEditBlockEditSession } from "./click-to-edit/ClickToEditBlock";

interface BrandDefaults {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  buttonColor: string;
  headerBgColor: string;
  logoUrl: string;
  fontFamily: string;
  loaded: boolean;
}

type SuggestedBlockKind =
  | "header"
  | "image_text"
  | "button"
  | "product_gallery";

interface CleanEmailBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
  onRequestAddBlock?: (afterIndex?: number) => void;
  generatingBlocks?: Set<string>;
  campaignName?: string;
  campaignId?: string;
  onOpenAIImageDialog?: (blockId: string) => void;
  footerBackgroundColor?: string;
  onFooterColorChange?: (color: string | undefined) => void;
  onFooterStylingChange?: (
    styling: import("@/types/footerStyling").FooterStyling,
  ) => void;
  brandDefaults?: BrandDefaults;
  preheaderText?: string;
  suggestionsEnabled?: boolean;
  onEditSessionChange?: (session: ClickToEditBlockEditSession | null) => void;
}

function createBlockId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSuggestedBlock(kind: SuggestedBlockKind): ContentBlock | null {
  switch (kind) {
    case "header":
      return {
        id: createBlockId("hero"),
        type: "email-safe-hero",
        source: "manual",
        headline: "",
        subtitle: "",
        eyebrow: "",
        imageUrl: "",
        altText: "",
        ctaText: "",
        ctaUrl: "",
        textAlign: "center",
        backgroundColor: "#f5f5f7",
        textColor: "#111111",
        padding: "large",
        shouldFetchImage: false,
        isGeneratingImage: false,
        autoImageMode: false,
        visible: true,
        collapsed: false,
      };
    case "image_text":
      return {
        id: createBlockId("image_text"),
        type: "image-text",
        source: "manual",
        headline: "",
        title: "",
        subtitle: "",
        body: "",
        content: "",
        imageUrl: "",
        altText: "",
        layout: "two-column-left",
        textAlign: "left",
        alignment: "left",
        backgroundColor: "#f5f5f7",
        textColor: "#111111",
        buttonText: "",
        buttonUrl: "",
        visible: true,
        collapsed: false,
      };
    case "button":
      return {
        id: createBlockId("button"),
        type: "button",
        source: "manual",
        heading: "Call to action",
        body: "Explain what happens next.",
        buttonText: "Learn more",
        buttonUrl: "",
        alignment: "center",
        padding: "medium",
        visible: true,
        collapsed: false,
      };
    case "product_gallery":
      return {
        id: createBlockId("product_gallery"),
        type: "product-gallery",
        source: "manual",
        headline: "Product gallery",
        body: "Showcase featured products, bundles, or seasonal picks.",
        galleryItems: [],
        columns: 2,
        showBadges: true,
        backgroundColor: "#ffffff",
        ctaText: "Shop now",
        ctaUrl: "",
        visible: true,
        collapsed: false,
      };
    default:
      return null;
  }
}

// Enhanced mapping function to convert layout types to block types and configurations
const mapLayoutToBlock = async (
  layoutType: LayoutType,
): Promise<{ type: ContentBlock["type"]; config: Partial<ContentBlock> }> => {
  switch (layoutType) {
    // NEW: Email-safe hero - recommended for dark mode compatibility
    // Brand primary color applied via brandDefaults override in addBlockWithLayout
    case "email-safe-hero":
      return {
        type: "email-safe-hero",
        config: {
          headline: "",
          subtitle: "",
          eyebrow: "",
          publishDate: "",
          imageUrl: "",
          altText: "",
          ctaText: "",
          ctaUrl: "",
          textAlign: "center",
          backgroundColor: undefined,
          textColor: undefined,
          padding: "large",
          shouldFetchImage: false,
          isGeneratingImage: false,
          autoImageMode: false,
        },
      };
    // NEW: Graphic hero - single clickable image with text baked in
    case "graphic-hero":
      return {
        type: "graphic-hero",
        config: {
          imageUrl: "",
          altText: "",
          ctaUrl: "",
          shouldFetchImage: false,
          isGeneratingImage: false,
          autoImageMode: false,
        },
      };
    // Newsletter-specific layouts
    case "newsletter-header":
      return {
        type: "newsletter-header",
        config: {
          title: "",
          subtitle: "",
          issueNumber: "",
          publishDate: new Date().toLocaleDateString(),
          backgroundImageUrl: "",
          alignment: "center",
          padding: "large",
        },
      };
    case "quote-featured":
      return {
        type: "quote",
        config: {
          quote: "",
          author: "",
          authorTitle: "",
          alignment: "center",
          padding: "large",
        },
      };
    // Enhanced image layouts
    case "image-background":
      const bgImage = await mediaSelector({
        prompt: "natural garden background texture",
        count: 1,
      });
      return {
        type: "image",
        config: {
          content: "",
          altText: bgImage.alt || "Garden background",
          layout: "background",
          backgroundImageUrl: bgImage.url,
          backgroundOpacity: 30,
          alignment: "center",
        },
      };
    // Original layouts (enhanced)
    case "header-simple":
      return {
        type: "header",
        config: {
          headline: "",
          body: "",
          alignment: "center",
          padding: "medium",
        },
      };
    case "image-full":
      return {
        type: "image",
        config: {
          altText: "",
          caption: "",
          alignment: "center",
          layout: "full-width",
          imageUrl: "", // Start with empty image - user adds manually
        },
      };
    case "image-left":
      return {
        type: "image",
        config: {
          title: "",
          content: "",
          altText: "",
          alignment: "left",
          layout: "two-column-left",
          imageUrl: "", // Start with empty image - user adds manually
        },
      };
    case "image-right":
      return {
        type: "image",
        config: {
          title: "",
          content: "",
          altText: "",
          alignment: "right",
          layout: "two-column-right",
          imageUrl: "", // Start with empty image - user adds manually
        },
      };
    case "button-centered":
      return {
        type: "button",
        config: {
          heading: "",
          body: "",
          buttonText: "",
          buttonUrl: "",
          buttonColor: "", // Will be populated from company profile in parent component
          alignment: "center",
          padding: "medium",
        },
      };
    case "text-double":
      return {
        type: "image-text",
        config: {
          title: "",
          content: "",
          layout: "two-column-left",
          alignment: "left",
          imageUrl: "",
          shouldFetchImage: false,
          isGeneratingImage: false,
          autoImageMode: false,
        },
      };
    case "text-plain":
      return {
        type: "image-text",
        config: {
          title: "",
          content: "",
          layout: "full-width",
          alignment: "left",
          imageUrl: "",
          shouldFetchImage: false,
          isGeneratingImage: false,
          autoImageMode: false,
        },
      };
    case "image-gallery":
      return {
        type: "image-gallery",
        config: {
          headline: "",
          body: "",
          galleryImages: [],
          galleryLayout: "3-across",
          galleryGap: "medium",
          galleryImageRadius: "medium",
          ctaText: "",
          ctaUrl: "",
          shouldFetchImage: false,
          isGeneratingImage: false,
          autoImageMode: false,
        },
      };
    case "product-gallery":
      return {
        type: "product-gallery",
        config: {
          headline: "",
          body: "",
          galleryItems: [],
          columns: 2,
          showBadges: true,
          backgroundColor: "#ffffff",
          ctaText: "Shop Holiday",
          ctaUrl: "",
          shouldFetchImage: false,
          isGeneratingImage: false,
          autoImageMode: false,
        },
      };
    case "divider":
      return {
        type: "divider",
        config: {
          content: "solid",
          textColor: "#e2e8f0",
          dividerThickness: 1,
          margin: "medium",
        },
      };
    case "button":
      return {
        type: "button",
        config: {
          heading: "",
          body: "",
          buttonText: "",
          buttonUrl: "",
          buttonColor: "",
          alignment: "center",
          padding: "medium",
        },
      };
    default:
      return {
        type: "image-text",
        config: {
          title: "",
          content: "",
          imageUrl: "",
          shouldFetchImage: false,
          isGeneratingImage: false,
          autoImageMode: false,
        },
      };
  }
};

export const CleanEmailBlockEditor: React.FC<CleanEmailBlockEditorProps> = ({
  blocks,
  onBlocksChange,
  onRequestAddBlock,
  generatingBlocks = new Set(),
  campaignName,
  campaignId,
  onOpenAIImageDialog,
  footerBackgroundColor,
  onFooterColorChange,
  onFooterStylingChange,
  brandDefaults,
  preheaderText = "",
  suggestionsEnabled = true,
  onEditSessionChange,
}) => {
  const [internalBlocks, setInternalBlocks] = useState<ContentBlock[]>([]);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  // Enhanced hydration logic with proper state management
  useEffect(() => {
    // Skip if no blocks provided yet
    if (blocks.length === 0) {
      if (internalBlocks.length > 0) {
        setInternalBlocks([]);
        setHydrationComplete(true);
      }
      return;
    }

    // Create content signatures to detect meaningful changes
    const createContentSignature = (block: ContentBlock) => {
      const title = block.title || block.headline || "";
      const content = block.content || block.body || "";
      const imageUrl = block.imageUrl || "";
      const backgroundImageUrl = block.backgroundImageUrl || ""; // Include background image for newsletter headers
      const buttonText = block.buttonText || block.ctaText || "";
      const buttonUrl = block.buttonUrl || block.ctaUrl || "";
      const visible = block.visible !== false;
      // NEW: Include content generation flag
      const hasGenerated = (block as any).hasGeneratedContent ? "1" : "0";
      // Ensure content is a string before calling slice
      const contentStr =
        typeof content === "string" ? content : JSON.stringify(content || "");
      return `${block.id}:${block.type}:${title}:${contentStr.slice(0, 50)}:${imageUrl}:${backgroundImageUrl}:${buttonText}:${buttonUrl}:${visible}:${hasGenerated}`;
    };

    const currentSignature = internalBlocks
      .map(createContentSignature)
      .sort()
      .join("|");
    const newSignature = blocks.map(createContentSignature).sort().join("|");

    // PHASE 1: Extract hydration logic to function
    const hydrateBlock = (block: ContentBlock): ContentBlock => {
      const preservedFlags = {
        hasGeneratedContent: (block as any).hasGeneratedContent,
        contentGeneratedAt: (block as any).contentGeneratedAt,
        contentVersion: (block as any).contentVersion,
        isLoadingContent: (block as any).isLoadingContent, // PRESERVE loading flag
        isLoadingImage: (block as any).isLoadingImage, // PRESERVE image loading flag
      };

      return {
        ...block,
        // Standardized field naming: headline is canonical for titles, content for body text
        // Read priority: headline > title > heading. Write always to headline.
        headline: (block as any).hasGeneratedContent
          ? block.headline
          : block.headline || block.title || block.heading || "",
        body: (block as any).hasGeneratedContent
          ? block.body
          : block.body || block.content || "",
        // Mirror to title/content for backward compat with DB columns
        title: block.headline || block.title || block.heading || "",
        content: block.body || block.content || "",
        // Preserve newsletter-specific fields
        subtitle: block.subtitle || "",
        issueNumber: block.issueNumber || "",
        publishDate: block.publishDate || "",
        backgroundImageUrl: block.backgroundImageUrl || "",
        // Preserve overlay settings - prioritize top-level database columns
        overlayOpacity:
          block.overlayOpacity ??
          (typeof block.content === "object" && block.content
            ? (block.content as any).overlayOpacity
            : undefined),
        overlayColor:
          block.overlayColor ||
          (typeof block.content === "object" && block.content
            ? (block.content as any).overlayColor
            : undefined),
        // Preserve color overlay opacity and related fields
        colorOverlayOpacity:
          block.colorOverlayOpacity ??
          (typeof block.content === "object" && block.content
            ? (block.content as any).colorOverlayOpacity
            : undefined),
        darkOverlayOpacity:
          block.darkOverlayOpacity ??
          (typeof block.content === "object" && block.content
            ? (block.content as any).darkOverlayOpacity
            : undefined),
        backgroundColor:
          block.backgroundColor ||
          (typeof block.content === "object" && block.content
            ? (block.content as any).backgroundColor
            : undefined),
        backgroundOpacity:
          block.backgroundOpacity ??
          (typeof block.content === "object" && block.content
            ? (block.content as any).backgroundOpacity
            : undefined),
        textColor:
          block.textColor ||
          (typeof block.content === "object" && block.content
            ? (block.content as any).textColor
            : undefined),
        // Lift nested imageUrl to top level if missing at top level
        imageUrl:
          block.imageUrl ||
          (typeof block.content === "object" &&
            block.content &&
            (block.content as any).imageUrl) ||
          "",
        altText:
          block.altText ||
          (typeof block.content === "object" &&
            block.content &&
            (block.content as any).altText) ||
          "",
        // CRITICAL: Normalize CTA fields bidirectionally to prevent rendering issues
        ctaText: block.ctaText || block.buttonText || "",
        ctaUrl: block.ctaUrl || block.buttonUrl || "",
        buttonText: block.buttonText || block.ctaText || "",
        buttonUrl: block.buttonUrl || block.ctaUrl || "",
        visible: block.visible !== false,
        collapsed: block.collapsed || false,
        // RE-APPLY preserved flags to ensure they're not lost
        ...preservedFlags,
      };
    };

    if (currentSignature !== newSignature || !hydrationComplete) {
      // PHASE 1: Selective hydration - only hydrate blocks that actually changed
      const hydratedBlocks = blocks.map((newBlock, index) => {
        const oldBlock = internalBlocks[index];
        const oldSig = oldBlock ? createContentSignature(oldBlock) : "";
        const newSig = createContentSignature(newBlock);

        // If signatures match, return the existing internal block unchanged
        if (oldBlock && oldSig === newSig) {
          return oldBlock;
        }

        // Only hydrate blocks that actually changed
        return hydrateBlock(newBlock);
      });

      // PHASE 5: Defensive checks - prevent empty strings from overwriting content
      hydratedBlocks.forEach((hydratedBlock, index) => {
        const originalBlock = blocks[index];
        if ((originalBlock as any).hasGeneratedContent) {
          // If original had content but hydrated is empty, restore original
          if (originalBlock.headline && !hydratedBlock.headline) {
            console.error(
              "🚨 Prevented headline loss for block",
              originalBlock.id,
            );
            hydratedBlock.headline = originalBlock.headline;
          }
          if (originalBlock.body && !hydratedBlock.body) {
            console.error("🚨 Prevented body loss for block", originalBlock.id);
            hydratedBlock.body = originalBlock.body;
          }
        }

        // PHASE 5: Content preservation logging
        if (
          (originalBlock as any).hasGeneratedContent &&
          !(hydratedBlock as any).hasGeneratedContent
        ) {
          console.error("🚨 CONTENT FLAG LOST during hydration:", {
            blockId: hydratedBlock.id,
            originalFlag: (originalBlock as any).hasGeneratedContent,
            hydratedFlag: (hydratedBlock as any).hasGeneratedContent,
            originalHeadline: originalBlock.headline,
            hydratedHeadline: hydratedBlock.headline,
          });
        }
      });

      setInternalBlocks(hydratedBlocks);
      setHydrationComplete(true);
    }
  }, [blocks, hydrationComplete]);

  const addBlockWithLayout = async (layoutType: LayoutType, index?: number) => {
    try {
      const { type, config } = await mapLayoutToBlock(layoutType);

      // Apply brand defaults to block types that benefit from them
      const brandOverrides: Partial<ContentBlock> = {};
      if (brandDefaults?.loaded) {
        if (type === "header" || type === "newsletter-header") {
          brandOverrides.backgroundColor = brandDefaults.headerBgColor;
          brandOverrides.textColor = "#ffffff";
        }
        if (type === "email-safe-hero") {
          brandOverrides.backgroundColor = brandDefaults.primaryColor;
          brandOverrides.textColor = "#ffffff";
          brandOverrides.buttonColor = brandDefaults.buttonColor;
        }
        if (type === "button") {
          brandOverrides.buttonColor = brandDefaults.buttonColor;
        }
      }

      const newBlock: ContentBlock = {
        id: `block_${Date.now()}`,
        type,
        layout: "full-width",
        title: "",
        content: "",
        body: "",
        imageUrl: config.imageUrl || "",
        ctaText: "",
        ctaUrl: "",
        source: "manual",
        collapsed: false,
        alignment: "left",
        padding: "medium",
        margin: "medium",
        responsiveBehavior: "stack",
        visible: true,
        animation: "fade-in",
        shouldFetchImage: false,
        isGeneratingImage: false,
        autoImageMode: false,
        backgroundColor: undefined,
        // Apply layout-specific configuration, then brand overrides
        ...config,
        ...brandOverrides,
      };

      const newBlocks = [...internalBlocks];
      // When index is -1, insert at start (position 0)
      // When index is a number >= 0, insert after that index (position index + 1)
      // When index is undefined, insert at end
      const insertAt =
        index !== undefined ? (index === -1 ? 0 : index + 1) : newBlocks.length;
      newBlocks.splice(insertAt, 0, newBlock);
      setInternalBlocks(newBlocks);
      onBlocksChange(newBlocks);
    } catch (error) {
      console.error("Error adding block with layout:", error);
      // Fallback to adding block without auto-image
      const fallbackConfig = layoutType.includes("image")
        ? {
            type: "image" as const,
            config: {
              title: "Image Section",
              content: "Add your descriptive text here...",
              altText: "Image description",
              alignment: "left" as const,
              layout: "full-width" as const,
            },
          }
        : {
            type: "image-text" as const,
            config: {
              shouldFetchImage: false,
              isGeneratingImage: false,
              autoImageMode: false,
            },
          };

      const newBlock: ContentBlock = {
        id: `block_${Date.now()}`,
        type: fallbackConfig.type,
        layout: "full-width",
        title: "",
        content: "",
        imageUrl: "",
        ctaText: "",
        ctaUrl: "",
        source: "manual",
        collapsed: false,
        alignment: "left",
        padding: "medium",
        margin: "medium",
        responsiveBehavior: "stack",
        visible: true,
        animation: "fade-in",
        backgroundColor: undefined, // Ensure new blocks default to white background
        ...fallbackConfig.config,
      };

      const newBlocks = [...internalBlocks];
      // When index is -1, insert at start (position 0)
      // When index is a number >= 0, insert after that index (position index + 1)
      // When index is undefined, insert at end
      const insertAt =
        index !== undefined ? (index === -1 ? 0 : index + 1) : newBlocks.length;
      newBlocks.splice(insertAt, 0, newBlock);
      setInternalBlocks(newBlocks);
      onBlocksChange(newBlocks);
    }
  };

  const openAddModal = (index?: number) => {
    if (onRequestAddBlock) {
      onRequestAddBlock(index);
      return;
    }

    setInsertIndex(index ?? null);
    setIsModalOpen(true);
  };

  const handleModalAddBlock = async (layoutType: LayoutType) => {
    await addBlockWithLayout(layoutType, insertIndex ?? undefined);
    setIsModalOpen(false);
    setInsertIndex(null);
  };

  const addSuggestedBlock = (kind: SuggestedBlockKind) => {
    const nextBlock = createSuggestedBlock(kind);
    if (!nextBlock) {
      return;
    }

    const brandOverrides: Partial<ContentBlock> = {};
    if (brandDefaults?.loaded && kind === "header") {
      brandOverrides.backgroundColor = brandDefaults.headerBgColor;
      brandOverrides.textColor = brandDefaults.textColor;
    }
    if (brandDefaults?.loaded && kind === "button") {
      brandOverrides.buttonColor = brandDefaults.buttonColor;
    }

    const nextBlocks = [...internalBlocks, { ...nextBlock, ...brandOverrides }];
    setInternalBlocks(nextBlocks);
    onBlocksChange(nextBlocks);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    const newBlocks = internalBlocks.map((block) => {
      if (block.id === id) {
        // Simply merge updates at top level
        const updatedBlock: ContentBlock = { ...block, ...updates };

        // DEBUG: Log overlay values after merge for newsletter-header blocks
        if (
          updatedBlock.type === "newsletter-header" ||
          updatedBlock.type === "header"
        ) {
        }

        return updatedBlock;
      }
      return block;
    });
    setInternalBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  const removeBlock = (id: string) => {
    const newBlocks = internalBlocks.filter((block) => block.id !== id);
    setInternalBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  const duplicateBlock = (block: ContentBlock) => {
    const newBlock: ContentBlock = {
      ...block,
      id: `block_${Date.now()}`,
      title: block.title ? `${block.title} (Copy)` : block.title,
      headline: block.headline ? `${block.headline} (Copy)` : block.headline,
      collapsed: false,
    };
    const blockIndex = internalBlocks.findIndex((b) => b.id === block.id);
    const newBlocks = [...internalBlocks];
    newBlocks.splice(blockIndex + 1, 0, newBlock);
    setInternalBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    const currentIndex = internalBlocks.findIndex((block) => block.id === id);
    if (
      (direction === "up" && currentIndex === 0) ||
      (direction === "down" && currentIndex === internalBlocks.length - 1)
    ) {
      return;
    }

    const newBlocks = [...internalBlocks];
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    [newBlocks[currentIndex], newBlocks[targetIndex]] = [
      newBlocks[targetIndex],
      newBlocks[currentIndex],
    ];
    setInternalBlocks(newBlocks);
    onBlocksChange(newBlocks);
  };

  // Show loading only when hydrating existing blocks, not for empty campaigns
  const isInitialLoading =
    !hydrationComplete && blocks.length > 0 && internalBlocks.length === 0;
  if (isInitialLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin h-8 w-8 mx-auto mb-4 border-2 border-primary border-t-transparent rounded-full"></div>
            <p className="text-muted-foreground">Loading email builder...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Click-to-Edit Email Builder */}
      <ClickToEditEmailBuilder
        blocks={internalBlocks}
        onBlocksChange={(newBlocks) => {
          setInternalBlocks(newBlocks);
          onBlocksChange(newBlocks);
        }}
        onOpenAddModal={openAddModal}
        generatingBlocks={generatingBlocks}
        campaignName={campaignName}
        campaignId={campaignId}
        onOpenAIImageDialog={onOpenAIImageDialog}
        footerBackgroundColor={footerBackgroundColor}
        onFooterColorChange={onFooterColorChange}
        onFooterStylingChange={onFooterStylingChange}
        onEditSessionChange={onEditSessionChange}
      />

      {/* Smart next-block suggestion */}
      {suggestionsEnabled && (
        <NextBlockSuggestion
          blocks={internalBlocks}
          preheaderText={preheaderText ?? ""}
          onAddBlockKind={addSuggestedBlock}
        />
      )}

      {/* Block Layout Modal */}
      {onRequestAddBlock ? null : (
        <BlockLayoutModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelect={handleModalAddBlock}
        />
      )}
    </div>
  );
};
