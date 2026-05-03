import * as React from "react";
import {
  type StudioBlockType,
  STUDIO_BLOCK_LOOKUP,
} from "@/components/crm/studio/blockLibraryData";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import {
  ensureFooterBlockCompliance,
  hydrateFooterBlockWithDesignSystem,
} from "@/lib/studio/footerCompliance";
import type { StudioBlock } from "@/types/studioBlocks";
import type {
  StudioDeviceMode,
  StudioSidebarDragBlock,
} from "@/components/crm/studio/studioCanvasTypes";

const DEVICE_WIDTHS: Record<StudioDeviceMode, number> = {
  desktop: 640,
  tablet: 480,
  mobile: 375,
};

function normalizeBlocks(
  blocks: StudioBlock[],
  designSystem: StudioDesignSystem | null,
) {
  return ensureFooterBlockCompliance(blocks, { designSystem });
}

function areBlocksEqual(left: StudioBlock[], right: StudioBlock[]) {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

const STUDIO_WORD_FIELDS: Array<keyof StudioBlock> = [
  "headline",
  "subheading",
  "body",
  "tagLabel",
  "tagline",
  "dateLabel",
  "caption",
  "businessName",
  "address",
  "copyright",
  "copyrightText",
  "complianceText",
  "buttonText",
  "secondaryLinkText",
  "quoteText",
  "authorName",
  "authorTitle",
  "productName",
  "productPrice",
  "originalPrice",
  "productDescription",
  "badgeText",
  "socialLabel",
];

function countWords(value: string | undefined) {
  if (!value) {
    return 0;
  }

  return value.trim().split(/\s+/).filter(Boolean).length;
}

function countBlockWords(block: StudioBlock) {
  const baseCount = STUDIO_WORD_FIELDS.reduce((total, key) => {
    const value = block[key];
    return total + (typeof value === "string" ? countWords(value) : 0);
  }, 0);

  const galleryImageCount = Array.isArray(block.galleryImages)
    ? block.galleryImages.reduce(
        (total, image) =>
          total + countWords(image.alt) + countWords(image.caption),
        0,
      )
    : 0;

  const galleryProductCount = Array.isArray(block.galleryProducts)
    ? block.galleryProducts.reduce(
        (total, product) =>
          total +
          countWords(product.name) +
          countWords(product.price) +
          countWords(product.originalPrice) +
          countWords(product.description) +
          countWords(product.badgeText) +
          countWords(product.buttonText),
        0,
      )
    : 0;

  return baseCount + galleryImageCount + galleryProductCount;
}

function normalizeLoadedBlock(
  block: StudioBlock,
  index: number,
  designSystem: StudioDesignSystem | null,
) {
  return hydrateFooterBlockWithDesignSystem(
    {
      ...block,
      label:
        typeof block.label === "string" && block.label.trim().length > 0
          ? block.label
          : (STUDIO_BLOCK_LOOKUP[block.type]?.name ?? block.type),
      order: typeof block.order === "number" ? block.order : index,
      visible: block.visible !== false,
    },
    designSystem,
  );
}

export type StudioCampaignStatus = "Draft" | "Scheduled" | "Sending" | "Sent";

export type StudioCampaignSnapshot = {
  campaignName: string;
  campaignStatus: StudioCampaignStatus;
  subjectLine: string;
  previewText: string;
  senderName: string;
  senderEmail: string;
  blocks: StudioBlock[];
};

type UseStudioStateOptions = {
  initialCampaignName: string;
  designSystem: StudioDesignSystem;
};

export function useStudioState({
  initialCampaignName,
  designSystem,
}: UseStudioStateOptions) {
  const [blocks, setBlocks] = React.useState<StudioBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(
    null,
  );
  const [deviceMode, setDeviceMode] =
    React.useState<StudioDeviceMode>("desktop");
  const [campaignName, setCampaignName] = React.useState(initialCampaignName);
  const [campaignStatus, setCampaignStatus] =
    React.useState<StudioCampaignStatus>("Draft");
  const [subjectLine, setSubjectLine] = React.useState(
    "Mother's Day blooms are here",
  );
  const [previewText, setPreviewText] = React.useState(
    "Limited-run arrangements available this week.",
  );
  const [senderName, setSenderName] = React.useState("Your Business Name");
  const [senderEmail, setSenderEmail] = React.useState("hello@yourdomain.com");
  const [activeSidebarDragBlock, setActiveSidebarDragBlock] =
    React.useState<StudioSidebarDragBlock>(null);
  const [activeDropIndex, setActiveDropIndex] = React.useState<number | null>(
    null,
  );
  const [isDraggingOverCanvas, setIsDraggingOverCanvas] = React.useState(false);
  const [recentlyAddedBlockId, setRecentlyAddedBlockId] = React.useState<
    string | null
  >(null);
  const [removingBlockIds, setRemovingBlockIds] = React.useState<string[]>([]);

  const addAnimationTimeoutRef = React.useRef<number | null>(null);
  const removalTimeoutsRef = React.useRef<Record<string, number>>({});

  const clearTransientCanvasState = React.useCallback(() => {
    if (addAnimationTimeoutRef.current !== null) {
      window.clearTimeout(addAnimationTimeoutRef.current);
      addAnimationTimeoutRef.current = null;
    }

    Object.values(removalTimeoutsRef.current).forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });

    removalTimeoutsRef.current = {};
    setRecentlyAddedBlockId(null);
    setRemovingBlockIds([]);
    setActiveSidebarDragBlock(null);
    setActiveDropIndex(null);
    setIsDraggingOverCanvas(false);
  }, []);

  React.useEffect(() => {
    setCampaignName(initialCampaignName);
  }, [initialCampaignName]);

  React.useEffect(() => {
    return () => {
      clearTransientCanvasState();
    };
  }, [clearTransientCanvasState]);

  React.useEffect(() => {
    setBlocks((current) => {
      const normalizedBlocks = normalizeBlocks(current, designSystem);

      return areBlocksEqual(current, normalizedBlocks)
        ? current
        : normalizedBlocks;
    });
  }, [designSystem]);

  const selectedBlock = React.useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );

  const canvasWidth = DEVICE_WIDTHS[deviceMode];
  const isPropertiesPanelOpen = selectedBlockId !== null;
  const estimatedWordCount = React.useMemo(
    () => blocks.reduce((total, block) => total + countBlockWords(block), 0),
    [blocks],
  );

  const loadCampaign = React.useCallback(
    (campaign: StudioCampaignSnapshot) => {
      clearTransientCanvasState();
      setSelectedBlockId(null);
      setCampaignName(campaign.campaignName.trim() || initialCampaignName);
      setCampaignStatus(campaign.campaignStatus);
      setSubjectLine(campaign.subjectLine);
      setPreviewText(campaign.previewText);
      setSenderName(campaign.senderName);
      setSenderEmail(campaign.senderEmail);
      setBlocks(
        normalizeBlocks(
          campaign.blocks.map((block, index) =>
            normalizeLoadedBlock(block, index, designSystem),
          ),
          designSystem,
        ),
      );
    },
    [clearTransientCanvasState, designSystem, initialCampaignName],
  );

  const pulseInsertedBlock = React.useCallback((blockId: string) => {
    setRecentlyAddedBlockId(blockId);

    if (addAnimationTimeoutRef.current !== null) {
      window.clearTimeout(addAnimationTimeoutRef.current);
    }

    addAnimationTimeoutRef.current = window.setTimeout(() => {
      setRecentlyAddedBlockId((current) =>
        current === blockId ? null : current,
      );
      addAnimationTimeoutRef.current = null;
    }, 220);
  }, []);

  const addBlock = React.useCallback(
    (blockType: StudioBlockType, insertAtIndex?: number) => {
      let selectedBlockId: string | null = null;

      setBlocks((current) => {
        if (blockType === "footer") {
          const existingFooter = current.find(
            (block) => block.type === "footer",
          );

          if (existingFooter) {
            selectedBlockId = existingFooter.id;
            return current;
          }
        }

        const nextBlock = hydrateFooterBlockWithDesignSystem(
          createStudioBlock(blockType, designSystem),
          designSystem,
        );
        selectedBlockId = nextBlock.id;
        const nextIndex =
          blockType === "footer"
            ? current.length
            : insertAtIndex == null
              ? current.length
              : Math.max(0, Math.min(insertAtIndex, current.length));
        const nextBlocks = [...current];

        nextBlocks.splice(nextIndex, 0, nextBlock);
        return normalizeBlocks(nextBlocks, designSystem);
      });

      if (selectedBlockId) {
        setSelectedBlockId(selectedBlockId);

        if (
          blockType !== "footer" ||
          !blocks.some((block) => block.id === selectedBlockId)
        ) {
          pulseInsertedBlock(selectedBlockId);
        }
      }
    },
    [blocks, designSystem, pulseInsertedBlock],
  );

  const removeBlock = React.useCallback(
    (blockId: string) => {
      if (removalTimeoutsRef.current[blockId]) {
        return;
      }

      const targetBlock = blocks.find((block) => block.id === blockId);
      if (targetBlock?.type === "footer") {
        return;
      }

      setRemovingBlockIds((current) =>
        current.includes(blockId) ? current : [...current, blockId],
      );
      setSelectedBlockId((current) => (current === blockId ? null : current));

      removalTimeoutsRef.current[blockId] = window.setTimeout(() => {
        setBlocks((current) =>
          normalizeBlocks(
            current.filter((block) => block.id !== blockId),
            designSystem,
          ),
        );
        setRemovingBlockIds((current) =>
          current.filter((id) => id !== blockId),
        );
        delete removalTimeoutsRef.current[blockId];
      }, 200);
    },
    [blocks, designSystem],
  );

  const duplicateBlock = React.useCallback(
    (blockId: string) => {
      let duplicateId: string | null = null;

      setBlocks((current) => {
        const sourceIndex = current.findIndex((block) => block.id === blockId);

        if (sourceIndex < 0) {
          return current;
        }

        if (current[sourceIndex].type === "footer") {
          duplicateId = current[sourceIndex].id;
          return current;
        }

        const duplicateBlock = {
          ...current[sourceIndex],
          id: crypto.randomUUID(),
          label: STUDIO_BLOCK_LOOKUP[current[sourceIndex].type].name,
        };
        duplicateId = duplicateBlock.id;

        const nextBlocks = [...current];
        nextBlocks.splice(sourceIndex + 1, 0, duplicateBlock);
        return normalizeBlocks(nextBlocks, designSystem);
      });

      if (duplicateId) {
        setSelectedBlockId(duplicateId);
        pulseInsertedBlock(duplicateId);
      }
    },
    [designSystem, pulseInsertedBlock],
  );

  const updateBlockField = React.useCallback(
    (
      blockId: string,
      field: keyof StudioBlock,
      value: StudioBlock[keyof StudioBlock],
    ) => {
      setBlocks((current) =>
        current.map((block) =>
          block.id === blockId ? { ...block, [field]: value } : block,
        ),
      );
    },
    [],
  );

  const reorderBlock = React.useCallback(
    (blockId: string, direction: "up" | "down") => {
      setBlocks((current) => {
        const sourceIndex = current.findIndex((block) => block.id === blockId);

        if (sourceIndex < 0) {
          return current;
        }

        if (current[sourceIndex].type === "footer") {
          return current;
        }

        const targetIndex =
          direction === "up" ? sourceIndex - 1 : sourceIndex + 1;

        if (targetIndex < 0 || targetIndex >= current.length) {
          return current;
        }

        const nextBlocks = [...current];
        const [movedBlock] = nextBlocks.splice(sourceIndex, 1);
        nextBlocks.splice(targetIndex, 0, movedBlock);
        return normalizeBlocks(nextBlocks, designSystem);
      });
    },
    [designSystem],
  );

  const moveBlock = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      setBlocks((current) => {
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= current.length ||
          toIndex >= current.length ||
          fromIndex === toIndex
        ) {
          return current;
        }

        if (current[fromIndex]?.type === "footer") {
          return current;
        }

        const nextBlocks = [...current];
        const [movedBlock] = nextBlocks.splice(fromIndex, 1);
        nextBlocks.splice(toIndex, 0, movedBlock);
        return normalizeBlocks(nextBlocks, designSystem);
      });
    },
    [designSystem],
  );

  const selectBlock = React.useCallback((blockId: string | null) => {
    setSelectedBlockId(blockId);
  }, []);

  const selectAdjacentBlock = React.useCallback(
    (direction: "next" | "previous") => {
      if (blocks.length === 0 || !selectedBlockId) {
        return;
      }

      const currentIndex = blocks.findIndex(
        (block) => block.id === selectedBlockId,
      );

      if (currentIndex < 0) {
        return;
      }

      const offset = direction === "next" ? 1 : -1;
      const nextIndex = (currentIndex + offset + blocks.length) % blocks.length;
      setSelectedBlockId(blocks[nextIndex].id);
    },
    [blocks, selectedBlockId],
  );

  const clearSidebarDragState = React.useCallback(() => {
    setActiveSidebarDragBlock(null);
    setActiveDropIndex(null);
    setIsDraggingOverCanvas(false);
  }, []);

  const beginSidebarDrag = React.useCallback((blockType: StudioBlockType) => {
    setActiveSidebarDragBlock({
      type: blockType,
      label: STUDIO_BLOCK_LOOKUP[blockType].name,
    });
    setActiveDropIndex(null);
    setIsDraggingOverCanvas(false);
  }, []);

  const logFocusFirstPropertyField = React.useCallback(
    (blockId: string) => {
      const block = blocks.find((item) => item.id === blockId);
      console.log(
        `Focus first property field for ${block?.label ?? "selected block"}`,
      );
    },
    [blocks],
  );

  return {
    blocks,
    selectedBlockId,
    selectedBlock,
    deviceMode,
    canvasWidth,
    isPropertiesPanelOpen,
    campaignName,
    campaignStatus,
    subjectLine,
    previewText,
    senderName,
    senderEmail,
    estimatedWordCount,
    activeSidebarDragBlock,
    activeDropIndex,
    isDraggingOverCanvas,
    recentlyAddedBlockId,
    removingBlockIds,
    addBlock,
    removeBlock,
    duplicateBlock,
    updateBlockField,
    reorderBlock,
    moveBlock,
    selectBlock,
    selectAdjacentBlock,
    setDeviceMode,
    setCampaignName,
    setCampaignStatus,
    setSubjectLine,
    setPreviewText,
    setSenderName,
    setSenderEmail,
    loadCampaign,
    beginSidebarDrag,
    setActiveDropIndex,
    setIsDraggingOverCanvas,
    clearSidebarDragState,
    logFocusFirstPropertyField,
  };
}
