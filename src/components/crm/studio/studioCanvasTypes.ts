import type { StudioBlockType } from "@/components/crm/studio/blockLibraryData";
import type { StudioBlock } from "@/types/studioBlocks";

export type StudioDeviceMode = "desktop" | "tablet" | "mobile";

export type { StudioBlock };
export type DummyBlock = StudioBlock;

export type CanvasReorderInstruction =
  | {
      kind: "direction";
      direction: "up" | "down";
    }
  | {
      kind: "index";
      index: number;
    };

export type StudioLibraryDragData = {
  kind: "library-block";
  blockType: StudioBlockType;
  label: string;
};

export type StudioCanvasBlockDragData = {
  kind: "canvas-block";
  blockId: string;
};

export type StudioDragData = StudioLibraryDragData | StudioCanvasBlockDragData;

export type StudioSidebarDragBlock = {
  type: StudioBlockType;
  label: string;
} | null;

export const STUDIO_CANVAS_APPEND_DROP_ID = "studio-canvas-append";
export const STUDIO_CANVAS_EMPTY_DROP_ID = "studio-canvas-empty";

export function getStudioInsertionDropId(index: number) {
  return `studio-insertion-${index}`;
}

export function parseStudioInsertionDropId(id: unknown) {
  if (typeof id !== "string") {
    return null;
  }

  const match = /^studio-insertion-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

export function getStudioLibraryDragId(blockType: StudioBlockType) {
  return `studio-library-${blockType}`;
}
