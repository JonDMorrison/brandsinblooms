import { describe, expect, it } from "vitest";
import { STUDIO_BLOCK_LOOKUP, type StudioBlockType } from "@/components/crm/studio/blockLibraryData";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { generateEmailHtml, renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import { heroPresets, graphicHeroPresets } from "@/lib/studio/layoutPresets";
import type { StudioBlock } from "@/types/studioBlocks";

const STOCK = "newsletter-fallback";
const types = Object.keys(STUDIO_BLOCK_LOOKUP) as StudioBlockType[];

describe("retired newsletter stock image", () => {
  it.each(types)("%s never renders it in the editor or in sent mail", (type) => {
    const block = { ...createStudioBlock(type), id: `b-${type}`, order: 0, visible: true } as StudioBlock;
    const editing = renderNewsletterBlock(block, null, undefined, { editing: true });
    const sent = renderNewsletterBlock(block);
    const email = generateEmailHtml({ blocks: [block] } as Parameters<typeof generateEmailHtml>[0]);
    expect(editing).not.toContain(STOCK);
    expect(sent).not.toContain(STOCK);
    expect(email).not.toContain(STOCK);
    // Editor placeholders never reach sent mail.
    expect(sent).not.toContain("data-editor-placeholder");
    expect(email).not.toContain("data-editor-placeholder");
  });

  it("empty hero photos show the neutral 'Add a photo' frame only while editing", () => {
    for (const [type, presets] of [["email-safe-hero", heroPresets], ["graphic-hero", graphicHeroPresets]] as const) {
      for (const preset of presets) {
        const block = { ...createStudioBlock(type), ...preset.fields, imageUrl: "", id: "h", order: 0, visible: true } as StudioBlock;
        const editing = renderNewsletterBlock(block, null, undefined, { editing: true });
        const sent = renderNewsletterBlock(block);
        expect(editing).not.toContain(STOCK);
        expect(sent).not.toContain(STOCK);
        expect(sent).not.toContain("Add a photo");
        if (type === "graphic-hero" || ["image-overlay", "image-bottom"].includes(String(block.heroStyle))) {
          expect(editing).toContain('data-editor-placeholder="image"');
        }
      }
    }
  });
});
