import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderExtendedBlock, plantCareFacts, plantCareTips } from "@/lib/studio/newsletter/renderExtensions";
import { isEditorEmptyBlock } from "@/lib/studio/newsletter/editorEmptyBlocks";
import type { StudioBlock } from "@/types/studioBlocks";

const plant = (extra: Partial<StudioBlock> = {}): StudioBlock => ({
  ...createStudioBlock("plant-care"),
  id: "p",
  order: 0,
  visible: true,
  headline: "Lavender",
  subheading: "Lavandula angustifolia",
  body: "A fragrant shrub for sunny borders.",
  imageUrl: "https://example.com/lavender.jpg",
  careLight: "Full sun",
  careWater: "Low once established",
  careTips: "- Trim after flowering\nDo not overwater\n\n",
  buttonUrl: "https://example.com/care/lavender",
  ...extra,
} as StudioBlock);

describe("Plant Care Spotlight", () => {
  it("starts empty and invents no care facts", () => {
    const fresh = createStudioBlock("plant-care");
    expect(plantCareFacts(fresh)).toEqual([]);
    expect(plantCareTips(fresh)).toEqual([]);
    expect(isEditorEmptyBlock(fresh)).toBe(true);
  });

  it("shows only the facts that were filled in", () => {
    const html = renderExtendedBlock(plant(), 600) ?? "";
    expect(html).toContain("Lavender");
    expect(html).toContain("Lavandula angustifolia");
    expect(html).toContain("Full sun");
    expect(html).toContain("Low once established");
    expect(html).not.toContain("Soil");
    expect(html).not.toContain("Hardiness");
    expect(html).not.toContain("This season");
    expect(html).not.toContain("Source:");
  });

  it("lists tips one per line and drops typed bullet marks", () => {
    expect(plantCareTips(plant())).toEqual(["Trim after flowering", "Do not overwater"]);
    expect(renderExtendedBlock(plant(), 600)).toContain("Care tips");
  });

  it("names the source when one is given", () => {
    expect(renderExtendedBlock(plant({ careSource: "Reviewed care guide" }), 600)).toContain("Source: Reviewed care guide");
  });

  it("escapes what staff type", () => {
    const html = renderExtendedBlock(plant({ careLight: "<script>alert(1)</script>" }), 600) ?? "";
    expect(html).not.toContain("<script>");
  });

  it("compact layout leaves out the description and tips", () => {
    const html = renderExtendedBlock(plant({ careLayout: "compact" }), 600) ?? "";
    expect(html).not.toContain("A fragrant shrub");
    expect(html).not.toContain("Care tips");
    expect(html).toContain("Full sun");
  });

  it("full-width feature puts the photo above the words", () => {
    const html = renderExtendedBlock(plant({ careLayout: "feature" }), 600) ?? "";
    expect(html.indexOf("lavender.jpg")).toBeLessThan(html.indexOf("Lavender</"));
    expect(html).toContain('max-width:600px');
  });

  it("hides the photo and button when switched off, and keeps them saved", () => {
    const block = plant({ showImage: false, showButton: false });
    const html = renderExtendedBlock(block, 600) ?? "";
    expect(html).not.toContain("lavender.jpg");
    expect(html).not.toContain("Read the full care guide");
    expect(block.imageUrl).toContain("lavender.jpg");
  });
});
