import { cloneSavedBlock } from "@/lib/studio/newsletter/savedBlocks";
import { isEmptyContentBlock } from "@/lib/studio/emailHtmlGenerator";
import type { NewsletterSettings } from "@/types/newsletterDesign";
import { normalizeNewsletterSettings } from "@/lib/studio/newsletter/settings";
import * as React from "react";
import {
  type StudioBlockType,
  STUDIO_BLOCK_LOOKUP,
} from "@/components/crm/studio/blockLibraryData";
import {
  createStudioBlock,
  withStarterContent,
} from "@/lib/studio/blockFactory";
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

const HISTORY_LIMIT = 100;

type BlockHistoryState = {
  past: StudioBlock[][];
  present: StudioBlock[];
  future: StudioBlock[][];
};

function normalizeBlocks(
  blocks: StudioBlock[],
  designSystem: StudioDesignSystem | null,
) {
  return ensureFooterBlockCompliance(blocks, { designSystem });
}

function reindexBlocks(blocks: StudioBlock[]) {
  return blocks.map((block, index) =>
    block.order === index ? block : { ...block, order: index },
  );
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

export type CampaignImageGallerySource = "upload" | "ai-generated" | "library";

export type CampaignImageIndicatorSource =
  CampaignImageGallerySource | "reused";

export interface CampaignImageGalleryItem {
  url: string;
  source: CampaignImageGallerySource;
  prompt?: string;
  blockLabel?: string;
  timestamp: number;
}

export interface CampaignImageFieldSourceRecord {
  source: CampaignImageIndicatorSource;
  timestamp: number;
  url: string;
}

type UseStudioStateOptions = {
  initialCampaignName: string;
  designSystem: StudioDesignSystem;
};

function normalizeCampaignImageText(
  value: string | undefined,
  maxLength: number,
) {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (!normalizedValue) {
    return undefined;
  }

  return normalizedValue.length > maxLength
    ? `${normalizedValue.slice(0, maxLength - 3).trimEnd()}...`
    : normalizedValue;
}

/**
 * Where "From my website" content goes: into the selected block when it is
 * empty and of the same type, otherwise right after the selected block.
 * With nothing selected it goes after the header (top of the email). It is
 * never appended at the bottom.
 */
export function placeInsertedBlocks(
  current: StudioBlock[],
  inserted: StudioBlock[],
  selectedId: string | null,
): { blocks: StudioBlock[]; focusId: string } {
  const next = [...current];
  const selectedIndex = selectedId ? next.findIndex((block) => block.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? next[selectedIndex] : null;

  if (selected && selected.type !== "footer" && isEmptyContentBlock(selected) && inserted[0]?.type === selected.type) {
    const [first, ...rest] = inserted;
    next.splice(selectedIndex, 1, { ...first, id: selected.id }, ...rest);
    return { blocks: next, focusId: rest.length ? rest[rest.length - 1].id : selected.id };
  }

  let index: number;
  if (selected && selected.type !== "footer") {
    index = selectedIndex + 1;
  } else {
    const headerIndex = next.findIndex((block) => block.type === "newsletter-header");
    index = headerIndex >= 0 ? headerIndex + 1 : 0;
  }
  const footerIndex = next.findIndex((block) => block.type === "footer");
  if (footerIndex >= 0 && index > footerIndex) index = footerIndex;
  next.splice(index, 0, ...inserted);
  return { blocks: next, focusId: inserted[inserted.length - 1].id };
}

/**
 * "Add all theme blocks": the theme's header replaces the newsletter header
 * (keeping its logo and id) instead of adding a second one. The other theme
 * blocks take the place of empty placeholder blocks when there are any,
 * otherwise they go right after the header. Never after the footer.
 */
export function placeThemeBlocks(
  current: StudioBlock[],
  themeBlocks: StudioBlock[],
): { blocks: StudioBlock[]; focusId: string | null } {
  const themeHeader = themeBlocks.find((block) => block.type === "newsletter-header") ?? null;
  const content = themeBlocks.filter(
    (block) => block.type !== "newsletter-header" && block.type !== "footer",
  );
  let next = [...current];

  const headerIndex = next.findIndex((block) => block.type === "newsletter-header");
  if (themeHeader) {
    if (headerIndex >= 0) {
      const existing = next[headerIndex] as StudioBlock & Record<string, unknown>;
      const logoFields = Object.fromEntries(
        Object.entries(existing).filter(([key]) => key.startsWith("logo")),
      );
      next[headerIndex] = { ...themeHeader, ...logoFields, id: existing.id };
    } else {
      next.unshift(themeHeader);
    }
  }

  const isPlaceholder = (block: StudioBlock) =>
    block.type !== "footer" &&
    block.type !== "newsletter-header" &&
    isEmptyContentBlock(block);
  const firstPlaceholder = next.findIndex(isPlaceholder);
  let index: number;
  if (firstPlaceholder >= 0) {
    // Position among the blocks that stay.
    index = next.slice(0, firstPlaceholder).filter((block) => !isPlaceholder(block)).length;
    next = next.filter((block) => !isPlaceholder(block));
  } else {
    const header = next.findIndex((block) => block.type === "newsletter-header");
    index = header >= 0 ? header + 1 : 0;
  }
  const footerIndex = next.findIndex((block) => block.type === "footer");
  if (footerIndex >= 0 && index > footerIndex) index = footerIndex;
  next.splice(index, 0, ...content);

  const focus = content[0] ?? themeHeader;
  const focusId = focus
    ? (next.find((block) => block.id === focus.id)?.id ??
      next.find((block) => block.type === "newsletter-header")?.id ??
      null)
    : null;
  return { blocks: next, focusId };
}

export function useStudioState({
  initialCampaignName,
  designSystem,
}: UseStudioStateOptions) {
  const [blockHistory, setBlockHistory] = React.useState<BlockHistoryState>({
    past: [],
    present: [],
    future: [],
  });
  const blocks = blockHistory.present;
  const [selectedBlockId, setSelectedBlockId] = React.useState<string | null>(
    null,
  );
  // Read by inserts that run inside setBlocks updaters.
  const selectedBlockIdRef = React.useRef<string | null>(null);
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
  const [campaignImageGallery, setCampaignImageGallery] = React.useState<
    CampaignImageGalleryItem[]
  >([]);
  const [campaignImageFieldSources, setCampaignImageFieldSources] =
    React.useState<Record<string, CampaignImageFieldSourceRecord>>({});

  const addAnimationTimeoutRef = React.useRef<number | null>(null);
  const removalTimeoutsRef = React.useRef<Record<string, number>>({});

  const setBlocks = React.useCallback(
    (update: React.SetStateAction<StudioBlock[]>) => {
      setBlockHistory((current) => {
        const next =
          typeof update === "function" ? update(current.present) : update;

        if (areBlocksEqual(current.present, next)) {
          return current;
        }

        return {
          past: [...current.past, current.present].slice(-HISTORY_LIMIT),
          present: next,
          future: [],
        };
      });
    },
    [],
  );

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
    setBlockHistory((current) => {
      const normalizedBlocks = normalizeBlocks(current.present, designSystem);

      return areBlocksEqual(current.present, normalizedBlocks)
        ? current
        : { ...current, present: normalizedBlocks };
    });
  }, [designSystem]);

  selectedBlockIdRef.current = selectedBlockId;
  const selectedBlock = React.useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );

  const newsletterSettings = blocks.find(
    (block) => block.type === "footer",
  )?.newsletterSettings;
  const canvasWidth =
    deviceMode === "desktop"
      ? normalizeNewsletterSettings(newsletterSettings).width!
      : DEVICE_WIDTHS[deviceMode];
  const setNewsletterSettings = React.useCallback(
    (settings: NewsletterSettings) => {
      setBlocks((current) =>
        current.map((block) =>
          block.type === "footer"
            ? {
                ...block,
                newsletterSettings: normalizeNewsletterSettings(settings),
              }
            : block,
        ),
      );
    },
    [setBlocks],
  );
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
      setBlockHistory({
        past: [],
        present: normalizeBlocks(
          campaign.blocks.map((block, index) =>
            normalizeLoadedBlock(block, index, designSystem),
          ),
          designSystem,
        ),
        future: [],
      });
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
      // Only one footer is allowed. Selecting the existing one is the helpful
      // response when someone tries to add a second.
      const existingFooter =
        blockType === "footer"
          ? blocks.find((block) => block.type === "footer")
          : undefined;

      if (existingFooter) {
        setSelectedBlockId(existingFooter.id);
        return;
      }

      // Create the block before queuing the state update. React can run the
      // updater later, so an id captured inside it is not reliable here and
      // the new block was sometimes left unselected.
      const nextBlock = withStarterContent(
        hydrateFooterBlockWithDesignSystem(
          createStudioBlock(blockType, designSystem),
          designSystem,
        ),
        designSystem,
      );

      setBlocks((current) => {
        if (
          blockType === "footer" &&
          current.some((block) => block.type === "footer")
        ) {
          return current;
        }

        const footerIndex = current.findIndex(
          (block) => block.type === "footer",
        );
        const lastContentIndex =
          footerIndex === -1 ? current.length : footerIndex;
        // With no explicit position, place the new block directly below the
        // block being edited so it appears where the person is working.
        const selectedIndex =
          selectedBlockId == null
            ? -1
            : current.findIndex((block) => block.id === selectedBlockId);
        const defaultIndex =
          selectedIndex === -1
            ? lastContentIndex
            : Math.min(selectedIndex + 1, lastContentIndex);
        const nextIndex =
          blockType === "footer"
            ? current.length
            : insertAtIndex == null
              ? defaultIndex
              : Math.max(0, Math.min(insertAtIndex, lastContentIndex));
        const nextBlocks = [...current];

        nextBlocks.splice(nextIndex, 0, nextBlock);
        return normalizeBlocks(reindexBlocks(nextBlocks), designSystem);
      });

      setSelectedBlockId(nextBlock.id);
      pulseInsertedBlock(nextBlock.id);
    },
    [blocks, designSystem, pulseInsertedBlock, selectedBlockId],
  );

  const insertSavedBlock = React.useCallback(
    (saved: StudioBlock) => {
      if (saved.type === "footer") return;
      const instance = {
        ...cloneSavedBlock(saved),
        id: crypto.randomUUID(),
        order: 0,
        visible: true,
      };
      setBlocks((current) => {
        const footerIndex = current.findIndex(
          (block) => block.type === "footer",
        );
        const next = [...current];
        next.splice(footerIndex < 0 ? next.length : footerIndex, 0, instance);
        return normalizeBlocks(reindexBlocks(next), designSystem);
      });
      setSelectedBlockId(instance.id);
      pulseInsertedBlock(instance.id);
    },
    [designSystem, pulseInsertedBlock],
  );

  const insertImportedBlocks = React.useCallback(
    (imported: StudioBlock[]) => {
      const copies = imported
        .slice(0, 100)
        .filter((block) => block.type !== "footer")
        .map(cloneSavedBlock);
      if (!copies.length) return;
      setBlocks((current) => {
        const next = [...current];
        const footerIndex = next.findIndex((block) => block.type === "footer");
        next.splice(footerIndex < 0 ? next.length : footerIndex, 0, ...copies);
        return normalizeBlocks(reindexBlocks(next), designSystem);
      });
      setSelectedBlockId(copies[0].id);
      pulseInsertedBlock(copies[0].id);
    },
    [designSystem, pulseInsertedBlock, setBlocks],
  );
  /** "Add all theme blocks": see placeThemeBlocks. */
  const insertThemeBlocks = React.useCallback(
    (themeBlocks: StudioBlock[]) => {
      const copies = themeBlocks
        .slice(0, 100)
        .filter((block) => block.type !== "footer")
        .map(cloneSavedBlock);
      if (!copies.length) return;
      setBlocks((current) =>
        normalizeBlocks(reindexBlocks(placeThemeBlocks(current, copies).blocks), designSystem),
      );
      // A replaced header keeps the existing header's id.
      const focusId =
        copies.find((block) => block.type !== "newsletter-header")?.id ??
        blocks.find((block) => block.type === "newsletter-header")?.id ??
        copies[0].id;
      setSelectedBlockId(focusId);
      pulseInsertedBlock(focusId);
    },
    [blocks, designSystem, pulseInsertedBlock, setBlocks],
  );
  /** Append preconfigured connected-site blocks before the compliance footer. */
  const insertConnectedContentBlocks = React.useCallback((items: StudioBlock[]) => {
    const valid=items.filter(block => block.type !== "footer" && Boolean(block.buttonUrl));
    if(valid.length===0)return;
    let focusId = valid[valid.length - 1].id;
    setBlocks(current=>{
      const placed = placeInsertedBlocks(current, valid, selectedBlockIdRef.current);
      focusId = placed.focusId;
      return normalizeBlocks(reindexBlocks(placed.blocks),designSystem);
    });
    setSelectedBlockId(focusId);
    pulseInsertedBlock(focusId);
  },[designSystem,pulseInsertedBlock,setBlocks]);

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
            reindexBlocks(current.filter((block) => block.id !== blockId)),
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
          ...structuredClone(current[sourceIndex]),
          id: crypto.randomUUID(),
          label: current[sourceIndex].label,
        };
        duplicateId = duplicateBlock.id;

        const nextBlocks = [...current];
        nextBlocks.splice(sourceIndex + 1, 0, duplicateBlock);
        return normalizeBlocks(reindexBlocks(nextBlocks), designSystem);
      });

      if (duplicateId) {
        setSelectedBlockId(duplicateId);
        pulseInsertedBlock(duplicateId);
      }
    },
    [designSystem, pulseInsertedBlock],
  );

  /**
   * Writes derived data onto a block (for example a pre-cropped image copy)
   * without adding an undo step: the user did not make this change.
   */
  const annotateBlockFields = React.useCallback(
    (blockId: string, fields: Partial<StudioBlock>) => {
      setBlockHistory((current) => {
        let changed = false;
        const present = current.present.map((block) => {
          if (block.id !== blockId) return block;
          changed = true;
          return { ...block, ...fields, id: block.id, type: block.type };
        });
        return changed ? { ...current, present } : current;
      });
    },
    [],
  );

  const updateBlockFields = React.useCallback((blockId: string, fields: Partial<StudioBlock>) => {
    setBlocks(current => current.map(block => block.id === blockId ? { ...block, ...fields, id: block.id, type: block.type } : block));
  }, [setBlocks]);

  const updateBlockField = React.useCallback(
    (
      blockId: string,
      field: keyof StudioBlock,
      value: StudioBlock[keyof StudioBlock],
    ) => {
      setBlocks((current) =>
        current.map((block) =>
          block.id === blockId
            ? {
                ...block,
                [field]: value,
                // All image sources (upload, library and AI) use this update path.
                // Adding a hero photo must also make it visible, in one undo step.
                ...(block.type === "email-safe-hero" &&
                field === "imageUrl" &&
                typeof value === "string" &&
                value.trim() &&
                block.heroStyle !== "image-overlay" &&
                block.heroStyle !== "image-bottom"
                  ? {
                      heroStyle: "image-bottom" as const,
                      layoutPreset: undefined,
                    }
                  : {}),
              }
            : block,
        ),
      );
    },
    [],
  );

  const registerCampaignImage = React.useCallback(
    (entry: CampaignImageGalleryItem) => {
      const normalizedUrl = entry.url.trim();

      if (!normalizedUrl) {
        return;
      }

      const normalizedEntry: CampaignImageGalleryItem = {
        blockLabel: normalizeCampaignImageText(entry.blockLabel, 80),
        prompt: normalizeCampaignImageText(entry.prompt, 200),
        source: entry.source,
        timestamp: entry.timestamp,
        url: normalizedUrl,
      };

      setCampaignImageGallery((current) => {
        const existingItem = current.find((item) => item.url === normalizedUrl);

        if (!existingItem) {
          return [normalizedEntry, ...current].sort(
            (left, right) => right.timestamp - left.timestamp,
          );
        }

        const nextItems = current.map((item) =>
          item.url === normalizedUrl
            ? {
                ...item,
                blockLabel: normalizedEntry.blockLabel ?? item.blockLabel,
                prompt: normalizedEntry.prompt ?? item.prompt,
                timestamp: normalizedEntry.timestamp,
              }
            : item,
        );

        return nextItems.sort(
          (left, right) => right.timestamp - left.timestamp,
        );
      });
    },
    [],
  );

  const setCampaignImageFieldSource = React.useCallback(
    (fieldKey: string, record: CampaignImageFieldSourceRecord | null) => {
      setCampaignImageFieldSources((current) => {
        if (!record) {
          const nextSources = { ...current };
          delete nextSources[fieldKey];
          return nextSources;
        }

        return {
          ...current,
          [fieldKey]: record,
        };
      });
    },
    [],
  );

  const resolveCampaignImageFieldSource = React.useCallback(
    (fieldKey: string, url?: string) => {
      const fieldSource = campaignImageFieldSources[fieldKey];

      if (fieldSource && (!url || fieldSource.url === url)) {
        return fieldSource;
      }

      if (!url) {
        return null;
      }

      const galleryItem = campaignImageGallery.find((item) => item.url === url);

      if (!galleryItem) {
        return null;
      }

      return {
        source: galleryItem.source,
        timestamp: galleryItem.timestamp,
        url: galleryItem.url,
      } satisfies CampaignImageFieldSourceRecord;
    },
    [campaignImageFieldSources, campaignImageGallery],
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
        return normalizeBlocks(reindexBlocks(nextBlocks), designSystem);
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
        return normalizeBlocks(reindexBlocks(nextBlocks), designSystem);
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

  const undo = React.useCallback(() => {
    clearTransientCanvasState();
    setSelectedBlockId(null);
    setBlockHistory((current) => {
      const previous = current.past.at(-1);

      if (!previous) {
        return current;
      }

      return {
        past: current.past.slice(0, -1),
        present: normalizeBlocks(previous, designSystem),
        future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, [clearTransientCanvasState, designSystem]);

  const redo = React.useCallback(() => {
    clearTransientCanvasState();
    setSelectedBlockId(null);
    setBlockHistory((current) => {
      const [next, ...remainingFuture] = current.future;

      if (!next) {
        return current;
      }

      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: normalizeBlocks(next, designSystem),
        future: remainingFuture,
      };
    });
  }, [clearTransientCanvasState, designSystem]);

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
    newsletterSettings,
    setNewsletterSettings,
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
    campaignImageGallery,
    campaignImageFieldSources,
    canUndo: blockHistory.past.length > 0,
    canRedo: blockHistory.future.length > 0,
    addBlock,
    insertSavedBlock,
    insertImportedBlocks,
    insertThemeBlocks,
    insertConnectedContentBlocks,
    removeBlock,
    duplicateBlock,
    updateBlockField,
    updateBlockFields,
    annotateBlockFields,
    registerCampaignImage,
    reorderBlock,
    resolveCampaignImageFieldSource,
    moveBlock,
    selectBlock,
    selectAdjacentBlock,
    setCampaignImageFieldSource,
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
    undo,
    redo,
    logFocusFirstPropertyField,
  };
}
