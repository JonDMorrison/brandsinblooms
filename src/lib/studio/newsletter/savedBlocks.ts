import type { StudioBlock } from "@/types/studioBlocks";
import { STUDIO_BLOCK_LOOKUP } from "@/components/crm/studio/blockLibraryData";
const MAX_BLOCK_BYTES = 256_000;
export interface SavedBlock {
  id: string;
  name: string;
  block: StudioBlock;
  updatedAt: string;
}
export function readSavedBlock(value: unknown): StudioBlock | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.type !== "string" ||
    !Object.prototype.hasOwnProperty.call(STUDIO_BLOCK_LOOKUP, record.type) ||
    record.type === "footer"
  )
    return null;
  if (typeof record.id !== "string" || typeof record.label !== "string")
    return null;
  for (const key of [
    "galleryImages",
    "galleryProducts",
    "links",
    "badges",
    "chartData",
  ]) {
    const items = record[key];
    if (
      items !== undefined &&
      (!Array.isArray(items) ||
        items.length > 500 ||
        items.some(
          (item) => !item || typeof item !== "object" || Array.isArray(item),
        ))
    )
      return null;
  }
  for (const key of ["textColumns", "tableHeaders"]) {
    const items = record[key];
    if (
      items !== undefined &&
      (!Array.isArray(items) || items.some((item) => typeof item !== "string"))
    )
      return null;
  }
  if (
    record.tableRows !== undefined &&
    (!Array.isArray(record.tableRows) ||
      record.tableRows.some(
        (row) =>
          !Array.isArray(row) || row.some((cell) => typeof cell !== "string"),
      ))
  )
    return null;
  for (const key of ["appearance", "audience"]) {
    if (
      record[key] !== undefined &&
      (!record[key] ||
        typeof record[key] !== "object" ||
        Array.isArray(record[key]))
    )
      return null;
  }
  try {
    const encoded = JSON.stringify(value);
    if (encoded.length > MAX_BLOCK_BYTES) return null;
    const clone = JSON.parse(encoded) as StudioBlock;
    delete clone.newsletterSettings;
    clone.order = 0;
    clone.visible = true;
    return clone;
  } catch {
    return null;
  }
}
export function savedBlockName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 160)
    throw new Error("Enter a block name between 1 and 160 characters.");
  return trimmed;
}
export function cloneSavedBlock(source: StudioBlock): StudioBlock {
  const block = readSavedBlock(source);
  if (!block)
    throw new Error("This saved block is not a supported newsletter block.");
  block.id = crypto.randomUUID();
  block.galleryImages = block.galleryImages?.map((image) => ({
    ...image,
    id: crypto.randomUUID(),
  }));
  block.galleryProducts = block.galleryProducts?.map((product) => ({
    ...product,
    id: crypto.randomUUID(),
  }));
  block.links = block.links?.map((link) => ({
    ...link,
    id: crypto.randomUUID(),
  }));
  block.badges = block.badges?.map((badge) => ({
    ...badge,
    id: crypto.randomUUID(),
  }));
  return block;
}
export function readBrowserSavedBlocks(
  storage: Pick<Storage, "getItem">,
): Array<{ name: string; block: StudioBlock }> {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem("bloomsuite-saved-block-templates") || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 100).flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const record = value as Record<string, unknown>;
      const block = readSavedBlock(record.block);
      return block
        ? [{ name: String(record.name || block.label).slice(0, 160), block }]
        : [];
    });
  } catch {
    return [];
  }
}
