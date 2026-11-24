import { STUDIO_BLOCK_LOOKUP } from "@/components/crm/studio/blockLibraryData";
import type { StudioBlock } from "@/types/studioBlocks";

const THEME_IMAGE_BLOCK_TYPES = new Set(["full-width-image", "image", "graphic-hero"]);

/**
 * Sidebar label for a theme block: its own title, never raw photo alt text
 * ("a garden filled with lots of different types of flowers").
 */
export function themeBlockLabel(block: StudioBlock): string {
  const headline = block.headline?.replace(/<[^>]*>/g, "").trim();
  if (headline) return headline;
  if (THEME_IMAGE_BLOCK_TYPES.has(block.type)) return "Theme photo";
  const body = (block.body ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (body) return body.length > 60 ? `${body.slice(0, 57).trimEnd()}...` : body;
  return STUDIO_BLOCK_LOOKUP[block.type]?.name ?? "Theme block";
}
