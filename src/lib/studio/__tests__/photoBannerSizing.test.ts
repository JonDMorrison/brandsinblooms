import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import { graphicHeroPresets } from "@/lib/studio/layoutPresets";
import type { StudioBlock } from "@/types/studioBlocks";

const banner = (presetKey: string, fields: Partial<StudioBlock> = {}) => {
  const preset = graphicHeroPresets.find((p) => p.key === presetKey)!;
  return {
    ...createStudioBlock("graphic-hero"),
    ...preset.fields,
    imageUrl: "https://example.com/photo.jpg",
    id: "banner",
    order: 0,
    visible: true,
    ...fields,
  } as StudioBlock;
};

describe("Photo Banner Max Height", () => {
  it.each([400, 600])("'Show whole photo' renders the photo at its own proportions, capped at %ipx", (maxHeight) => {
    const html = renderNewsletterBlock(banner("graphic-full-bleed", { maxHeight }));
    const img = html.match(/<img[^>]*photo\.jpg[^>]*>/)?.[0] ?? "";
    expect(img).toContain("height:auto");
    expect(img).toContain(`max-height:${maxHeight}px`);
    // No fixed-height background box, which letterboxed wide photos.
    expect(html).not.toContain(`height="${maxHeight}"`);
  });

  it("banners with text over the photo keep the background box", () => {
    const html = renderNewsletterBlock(banner("graphic-text-overlay", { headline: "New Arrivals", maxHeight: 400 }));
    expect(html).toContain('background="https://example.com/photo.jpg"');
    expect(html).toContain('height="400"');
  });

  it("'Fill the space' keeps the fixed-height box", () => {
    const html = renderNewsletterBlock(banner("graphic-full-bleed", { imageFit: "cover", maxHeight: 300 }));
    expect(html).toContain('height="300"');
  });
});
