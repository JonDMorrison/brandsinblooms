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

describe("fixes reported from the Arts Nursery review", () => {
  const editing = (block: StudioBlock) =>
    renderNewsletterBlock(block, null, undefined, { editing: true });

  it("a new gallery marks each photo frame with the slot a click fills", () => {
    const images = editing(fresh("image-gallery"));
    const products = editing(fresh("product-gallery"));
    for (const index of [0, 1, 2]) {
      expect(images).toContain(`data-newsletter-image="galleryImages" data-newsletter-index="${index}"`);
      expect(products).toContain(`data-newsletter-image="galleryProducts" data-newsletter-index="${index}"`);
    }
  });

  it("a gallery with one photo keeps clickable frames for its empty slots, in the editor only", () => {
    const block = {
      ...fresh("image-gallery"),
      galleryImages: [{ id: "a", url: "https://cdn.example.com/a.jpg", alt: "Fern" }],
    } as StudioBlock;
    const html = editing(block);
    expect(html).toContain('src="https://cdn.example.com/a.jpg"');
    expect(html).toContain('data-newsletter-image="galleryImages" data-newsletter-index="1"');
    expect(html).toContain('data-newsletter-image="galleryImages" data-newsletter-index="2"');
    expect(renderNewsletterBlock(block)).not.toContain("data-editor-placeholder");
  });

  it("a video block with words but no link keeps the words in the editor and stays out of sent mail", () => {
    const block = { ...fresh("youtube"), body: "Lorem ipsum dolor sit amet." } as StudioBlock;
    const html = editing(block);
    expect(text(html)).toContain("Lorem ipsum dolor sit amet.");
    expect(text(html)).toContain("Add a YouTube link");
    expect(text(renderNewsletterBlock(block))).not.toContain("Lorem ipsum");
    expect(renderNewsletterBlock(block)).not.toContain("data-editor-placeholder");
  });

  it("text columns show the chosen number and keep the words of a hidden column", () => {
    const three = {
      ...fresh("text-columns"),
      textColumns: ["One", "Two", "Three"],
      gridColumns: 3,
    } as StudioBlock;
    expect(text(renderNewsletterBlock(three))).toBe("One Two Three");

    const two = { ...three, gridColumns: 2 } as StudioBlock;
    expect(text(renderNewsletterBlock(two))).toBe("One Two");
    expect(two.textColumns).toEqual(["One", "Two", "Three"]);

    // Saved before the column count had its own field.
    const legacy = { ...three, gridColumns: undefined } as StudioBlock;
    expect(text(renderNewsletterBlock(legacy))).toBe("One Two Three");
  });

  it("a new text columns block starts with two columns", () => {
    const html = editing(fresh("text-columns"));
    expect(text(html)).toContain("Column 2");
    expect(text(html)).not.toContain("Column 3");
  });
});
