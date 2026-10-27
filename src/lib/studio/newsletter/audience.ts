import type { StudioBlock } from "../../../types/studioBlocks.ts";
export interface RenderAudience {
  segmentIds?: readonly string[];
  previewAll?: boolean;
}
/** Fail closed: a restricted block is never sent without recipient membership evidence. */
export function blockMatchesAudience(
  block: StudioBlock,
  audience?: RenderAudience,
): boolean {
  if (block.visible === false) return false;
  if (
    block.type === "footer" ||
    !block.audience ||
    block.audience.mode === "all"
  )
    return true;
  if (audience?.previewAll) return true;
  if (
    block.audience.mode !== "segments" ||
    !Array.isArray(block.audience.segmentIds) ||
    !Array.isArray(audience?.segmentIds)
  )
    return false;
  const membership = new Set(audience.segmentIds);
  return block.audience.segmentIds.some((id) => membership.has(id));
}
