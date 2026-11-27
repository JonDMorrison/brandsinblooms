import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import { withOutlookWholePhoto } from "@/lib/studio/emailImageCrop";
import { renderExtendedBlock } from "@/lib/studio/newsletter/renderExtensions";
import type { StudioBlock } from "@/types/studioBlocks";

const block = (type: Parameters<typeof createStudioBlock>[0], extra: Partial<StudioBlock>): StudioBlock => ({
  ...createStudioBlock(type), id: "b", order: 0, visible: true, headline: "Workshop",
  imageUrl: "https://example.com/photo.jpg", ...extra,
} as StudioBlock);

describe("cropped photos in desktop Outlook", () => {
  it("gives Outlook the whole photo and other clients the cropped one", () => {
    const html = withOutlookWholePhoto('<img src="a.jpg" style="height:200px;object-fit:cover;" />', { src: "a.jpg", alt: "A", width: 250.4 });
    expect(html).toContain('<!--[if mso]><img src="a.jpg" alt="A" width="250" style="display:block;width:250px;height:auto;border:0;" /><![endif]-->');
    expect(html).toContain("<!--[if !mso]><!--><img");
    expect(html.endsWith("<!--<![endif]-->")).toBe(true);
  });

  it("covers the Event photo, which is cropped by default", () => {
    const html = renderExtendedBlock(block("event", {}), 600) ?? "";
    expect(html).toContain("<!--[if mso]>");
    expect(html).toContain("height:auto");
  });

  it("covers Blog Post, Announcement and Plant Care when set to fill", () => {
    for (const type of ["blog", "announcement", "plant-care"] as const) {
      expect(renderExtendedBlock(block(type, { imageFit: "cover" }), 600)).toContain("<!--[if mso]>");
    }
  });

  it("leaves whole photos alone", () => {
    expect(renderExtendedBlock(block("event", { imageFit: "contain" }), 600)).not.toContain("<!--[if mso]>");
    expect(renderExtendedBlock(block("blog", {}), 600)).not.toContain("<!--[if mso]>");
  });

  it("survives the full email render", () => {
    const html = generateEmailHtml({ blocks: [block("event", {})] } as Parameters<typeof generateEmailHtml>[0]);
    expect(html).toContain("<!--[if mso]><img ");
    expect(html).toContain("<!--[if !mso]><!-->");
  });
});
