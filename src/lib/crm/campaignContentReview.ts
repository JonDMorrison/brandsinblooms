import type { StudioBlock } from "@/types/studioBlocks";
export type ContentReviewIssue = { blockId: string; message: string };
const unfinished =
  /^(?:#|https?:\/\/(?:www\.)?example\.com\/?|https?:\/\/|your[- ]?(?:url|link))$/i;
export function reviewCampaignContent(
  blocks: StudioBlock[],
): ContentReviewIssue[] {
  const issues: ContentReviewIssue[] = [];
  for (const [index, block] of blocks.entries()) {
    if (block.visible === false) continue;
    const label = `Block ${index + 1}`;
    const add = (message: string) =>
      issues.push({ blockId: block.id, message: `${label}: ${message}` });
    const walk = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      const row = value as Record<string, unknown>;
      if (
        typeof row.buttonText === "string" &&
        row.buttonText.trim() &&
        (typeof row.buttonUrl !== "string" || !row.buttonUrl.trim())
      )
        add("Button needs a destination.");
      for (const [key, item] of Object.entries(row)) {
        if (
          typeof item === "string" &&
          /(?:url|href)$/i.test(key) &&
          unfinished.test(item.trim())
        )
          add("Replace the sample link with your destination.");
        if (typeof item === "object") {
          if (Array.isArray(item)) item.forEach(walk);
          else walk(item);
        }
      }
    };
    walk(block);
    if (
      ["image", "image-text", "image-with-text"].includes(block.type) &&
      !block.imageUrl?.trim()
    )
      add("Add an image or remove this image block.");
  }
  return issues.filter(
    (issue, i) =>
      issues.findIndex(
        (other) =>
          other.blockId === issue.blockId && other.message === issue.message,
      ) === i,
  );
}
