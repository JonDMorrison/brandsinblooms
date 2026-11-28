// Text Columns block helpers. No runtime imports: the email generator (and
// so the Deno send pipeline) loads this.
import type { StudioBlock } from "../../../types/studioBlocks.ts";

/**
 * How many columns a Text Columns block shows. The chosen number lives in
 * gridColumns so the words in a hidden column are kept when the person
 * switches back. Blocks saved before that used the length of textColumns.
 */
export function textColumnCount(
  block: Pick<StudioBlock, "gridColumns" | "textColumns">,
): number {
  const saved = (block.textColumns ?? []).length;
  const chosen =
    typeof block.gridColumns === "number" && Number.isFinite(block.gridColumns)
      ? Math.round(block.gridColumns)
      : saved || 2;
  return Math.max(1, Math.min(3, chosen));
}

/** The columns that are shown, padded with empty text up to the count. */
export function visibleTextColumns(
  block: Pick<StudioBlock, "gridColumns" | "textColumns">,
): string[] {
  const saved = block.textColumns ?? [];
  return Array.from(
    { length: textColumnCount(block) },
    (_, index) => saved[index] ?? "",
  );
}
