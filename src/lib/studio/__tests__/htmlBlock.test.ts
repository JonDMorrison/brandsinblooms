import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { generateEmailHtml, renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

const htmlBlock = (customHtml: string) =>
  ({ ...createStudioBlock("html"), id: "h", order: 0, visible: true, customHtml }) as StudioBlock;

describe("HTML block", () => {
  it("is in the block library with an empty start", () => {
    expect(createStudioBlock("html")).toMatchObject({ type: "html", label: "HTML", customHtml: "" });
  });

  it("sends only the cleaned HTML, in the canvas and in sent mail", () => {
    const block = htmlBlock('<p style="color:#1d6877">Fall hours <strong>9–6</strong></p><script>alert(1)</script><img src="https://cdn.northfield.ca/a.png" onerror="alert(1)" alt="Leaf">');
    for (const html of [
      renderNewsletterBlock(block, null, undefined, { editing: true }),
      renderNewsletterBlock(block),
      generateEmailHtml({ blocks: [block] } as Parameters<typeof generateEmailHtml>[0]),
    ]) {
      expect(html).toContain('Fall hours <strong>9–6</strong>');
      expect(html).toContain('<img src="https://cdn.northfield.ca/a.png" alt="Leaf">');
      expect(html).not.toMatch(/<script|onerror|alert\(1\)/);
    }
  });

  it("an empty HTML block shows a sample in the editor and nothing in sent mail", () => {
    const block = htmlBlock("");
    expect(renderNewsletterBlock(block, null, undefined, { editing: true })).toContain("Your HTML goes here");
    expect(renderNewsletterBlock(block)).not.toContain("Your HTML goes here");
    expect(renderNewsletterBlock(block)).not.toContain("data-newsletter-html");
  });

  it("an HTML block holding only an image is not treated as empty", () => {
    const html = renderNewsletterBlock(htmlBlock('<img src="https://cdn.northfield.ca/a.png" alt="Leaf">'), null, undefined, { editing: true });
    expect(html).toContain("cdn.northfield.ca/a.png");
    expect(html).not.toContain("Your HTML goes here");
  });
});
