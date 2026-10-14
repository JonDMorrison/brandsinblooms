export interface GardenImage { url: string; alt: string; }
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function imageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const parsed = new URL(value.trim()); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; }
}
/** The image columns belong to product_images, not products. Never borrow images from another tenant's query. */
export function gardenImagesFromProducts(value: unknown): GardenImage[] {
  if (!Array.isArray(value)) return [];
  const images: GardenImage[] = [], seen = new Set<string>();
  for (const item of value) {
    const product = record(item);
    if (!product || !Array.isArray(product.product_images)) continue;
    const candidates = product.product_images.map(record).filter((image): image is Record<string, unknown> => image !== null)
      .sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true) || (typeof a.sort_order === 'number' ? a.sort_order : 0) - (typeof b.sort_order === 'number' ? b.sort_order : 0));
    const url = candidates.flatMap(image => [imageUrl(image.image_url), imageUrl(image.thumbnail_url)]).find((candidate): candidate is string => candidate !== null && !seen.has(candidate));
    if (!url) continue;
    seen.add(url);
    images.push({ url, alt: typeof product.name === 'string' && product.name.trim() ? product.name.trim() : 'Garden centre product' });
    if (images.length === 3) break;
  }
  return images;
}
