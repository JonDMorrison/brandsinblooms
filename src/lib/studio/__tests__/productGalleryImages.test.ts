import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { generateEmailHtml, renderStudioBlocksToEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import { productGalleryImageSizing } from "@/lib/studio/newsletter/renderExtensions";
import type { StudioBlock } from "@/types/studioBlocks";

const products = [
  { id: "a", name: "Bloodgood Maple", price: "$89.99", originalPrice: "$119.99", imageUrl: "https://placehold.co/1200x1200/png" },
  { id: "b", name: "Limelight Hydrangea", price: "$39.99", imageUrl: "https://placehold.co/1200x800/png" },
  { id: "c", name: "Ostrich Fern", price: "$14.99", imageUrl: "https://placehold.co/800x1200/png" },
  { id: "d", name: "Gift Card", price: "From $25", imageUrl: "https://placehold.co/640x360/png" },
];

function gallery(fields: Partial<StudioBlock>): StudioBlock {
  return {
    id: "gallery",
    type: "product-gallery",
    label: "Product Gallery",
    order: 0,
    visible: true,
    layout: "row-4",
    gridColumns: 4,
    galleryProducts: products,
    ...fields,
  } as StudioBlock;
}

const images = (html: string) =>
  [...html.matchAll(/<img data-newsletter-image="galleryProducts"[^>]*>/g)].map((m) => m[0]);

describe("Product Gallery image ratio", () => {
  it("new galleries default to Square + Fill the space with original prices shown", () => {
    const block = createStudioBlock("product-gallery");
    expect(block).toMatchObject({ imageRatio: "1:1", imageFit: "cover", showOriginalPrice: true });
    expect(block.imageHeight).toBeUndefined();
  });

  it.each([
    ["1:1", 1],
    ["4:3", 3 / 4],
    ["3:4", 4 / 3],
  ] as const)("desktop: %s box uses the cell width and the chosen ratio", (ratio, factor) => {
    const html = renderStudioBlocksToEmailHtml([gallery({ imageRatio: ratio, imageFit: "cover" })]);
    const imgs = images(html);
    expect(imgs).toHaveLength(4);
    for (const img of imgs) {
      const width = Number(img.match(/ width="(\d+)"/)?.[1]);
      const height = Number(img.match(/ height="(\d+)"/)?.[1]);
      expect(height).toBe(Math.round(width * factor));
      expect(img).toContain(`height:${height}px`);
      expect(img).toContain("object-fit:cover");
      expect(img).toContain(`nl-r-${ratio.replace(":", "x")}`);
    }
    // 4 across in 640px is no longer the portrait 136x160 box.
    if (ratio === "1:1") expect(imgs[0]).not.toContain("height:160px");
  });

  it("Original keeps each photo's own shape", () => {
    const html = renderStudioBlocksToEmailHtml([gallery({ imageRatio: "auto" })]);
    for (const img of images(html)) {
      expect(img).toContain("height:auto");
      expect(img).toContain("nl-r-auto");
    }
  });

  it("ratio wins over an older Image height; height alone is kept", () => {
    expect(productGalleryImageSizing(gallery({ imageRatio: "4:3", imageHeight: 260 }), 200)).toEqual({
      height: 150, fit: "cover", className: "nl-product-image nl-r-4x3",
    });
    expect(productGalleryImageSizing(gallery({ imageHeight: 260, imageFit: "contain" }), 200)).toEqual({
      height: 260, fit: "contain", className: "nl-product-image nl-h-260",
    });
    // A saved gallery that set neither relied on the old defaults: Square + fill.
    expect(productGalleryImageSizing(gallery({}), 200)).toEqual({
      height: 200, fit: "cover", className: "nl-product-image nl-r-1x1",
    });
  });

  it("mobile: the ratio and fit survive the responsive height:auto rule", () => {
    const html = generateEmailHtml({ blocks: [gallery({ imageRatio: "1:1" })], subject: "QA", previewText: "" } as Parameters<typeof generateEmailHtml>[0]);
    const mobile = html.slice(html.indexOf("@media only screen and (max-width: 599px)"));
    expect(mobile).toContain("img.responsive-image.nl-product-image.nl-r-1x1 { height:343px !important; }");
    expect(mobile).toContain("img.responsive-image.nl-product-image.nl-r-1x1 { height:auto !important; aspect-ratio:1 / 1 !important; }");
    // More specific than ".responsive-image { height:auto !important }".
    expect(mobile.indexOf("nl-r-1x1")).toBeGreaterThan(mobile.indexOf(".responsive-image { width:100%"));
    // object-fit stays inline, so phones keep "Fill the space".
    expect(images(html)[0]).toContain("object-fit:cover");
  });

  it("mobile: galleries with a fixed Image height keep it on phones", () => {
    const html = generateEmailHtml({ blocks: [gallery({ imageHeight: 260, imageFit: "cover" })], subject: "QA", previewText: "" } as Parameters<typeof generateEmailHtml>[0]);
    expect(html).toContain("img.responsive-image.nl-product-image.nl-h-260 { height:260px !important; }");
  });

  it("cards in a row stretch to equal height", () => {
    const html = renderStudioBlocksToEmailHtml([gallery({ imageRatio: "1:1" })]);
    const cells = [...html.matchAll(/<td class="responsive-column nl-product-cell"[^>]*><table[^>]*>/g)].map((m) => m[0]);
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell).toContain("height:100%;padding");
      expect(cell).toContain('height="100%"');
    }
  });
});
