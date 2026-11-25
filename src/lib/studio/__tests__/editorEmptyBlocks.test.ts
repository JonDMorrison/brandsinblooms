import { describe, expect, it } from "vitest";
import type { StudioBlockType } from "@/components/crm/studio/blockLibraryData";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { generateEmailHtml, renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import { isEditorEmptyBlock } from "@/lib/studio/newsletter/editorEmptyBlocks";
import type { StudioBlock } from "@/types/studioBlocks";

const SAMPLE_TYPES: StudioBlockType[] = [
  "plain-text", "full-width-image", "image-text", "text-columns", "button-group",
  "navigation", "youtube", "image-gallery", "product-gallery", "data-table",
  "chart", "survey", "event", "blog", "announcement", "product-card",
];

const fresh = (type: StudioBlockType) =>
  ({ ...createStudioBlock(type), id: `b-${type}`, order: 0, visible: true }) as StudioBlock;

const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("new blocks show their real layout in the editor", () => {
  it.each(SAMPLE_TYPES)("%s shows a sample layout while editing and nothing extra when sent", (type) => {
    const block = fresh(type);
    expect(isEditorEmptyBlock(block)).toBe(true);
    const editing = renderNewsletterBlock(block, null, undefined, { editing: true });
    expect(editing).toContain(`data-editor-sample="${type}"`);
    expect(editing).toMatch(/data-editor-placeholder="(image|copy)"/);
    expect(text(editing).length).toBeGreaterThan(0);

    const sent = renderNewsletterBlock(block);
    const email = generateEmailHtml({ blocks: [block] } as Parameters<typeof generateEmailHtml>[0]);
    for (const html of [sent, email]) {
      expect(html).not.toContain("data-editor-placeholder");
      expect(html).not.toContain("data-editor-sample");
      expect(html).not.toContain("Add a photo");
    }
  });

  it("Image + Text shows a grey frame beside a sample heading, text and button", () => {
    const html = renderNewsletterBlock(fresh("image-text"), null, undefined, { editing: true });
    expect(html).toContain('data-editor-placeholder="image"');
    expect(html).toContain('data-newsletter-image="imageUrl"');
    expect(html).toMatch(/Your headline[\s\S]*A line of text[\s\S]*Button/);
    // Side by side: one row, two columns.
    expect(html.match(/class="responsive-column"/g)).toHaveLength(2);
  });

  it("Event, Blog and Announcement no longer open as a bare button", () => {
    for (const type of ["event", "blog", "announcement"] as const) {
      const html = renderNewsletterBlock(fresh(type), null, undefined, { editing: true });
      expect(html).toContain('data-editor-placeholder="image"');
      expect(html).toMatch(/title|Announcement/);
    }
  });

  it("a block with any real content renders normally, without samples", () => {
    const filled: Array<[StudioBlockType, Partial<StudioBlock>]> = [
      ["plain-text", { body: "Hello" }],
      ["image-text", { headline: "Spring" }],
      ["event", { headline: "Pruning workshop" }],
      ["chart", { chartData: [{ label: "A", value: 1 }] }],
      ["product-gallery", { galleryProducts: [{ id: "p", name: "Maple", price: "$9", imageUrl: "" }] }],
    ];
    for (const [type, fields] of filled) {
      const block = { ...fresh(type), ...fields } as StudioBlock;
      expect(isEditorEmptyBlock(block)).toBe(false);
      expect(renderNewsletterBlock(block, null, undefined, { editing: true })).not.toContain("data-editor-sample");
    }
  });
});
