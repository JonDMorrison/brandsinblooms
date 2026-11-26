import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { hydrateFooterBlockWithDesignSystem } from "@/lib/studio/footerCompliance";
import { MIN_BANNER_HEIGHT, renderFooterBlockToEmailHtml, renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import { footerDetailSource } from "@/components/crm/studio/BlockPropertiesPanel";
import type { StudioBlock } from "@/types/studioBlocks";

const designSystem = buildStudioDesignSystem({
  name: "Northfield Garden Center",
  streetAddress: "12 Orchard Road",
  city: "Abbotsford",
  stateProvince: "BC",
  postalCode: "V2S 1A1",
  phone: "604-555-0100",
  email: "hello@northfield.example",
} as Parameters<typeof buildStudioDesignSystem>[0]);
const footer = (fields: Partial<StudioBlock> = {}) =>
  ({ ...createStudioBlock("footer", designSystem), id: "f", order: 0, visible: true, ...fields }) as StudioBlock;
const html = (block: StudioBlock) => renderFooterBlockToEmailHtml(block, { unsubscribeUrl: "https://example.com/unsubscribe" }, designSystem);

describe("footer business details", () => {
  it("a custom address that has been emptied is not refilled while editing", () => {
    const hydrated = hydrateFooterBlockWithDesignSystem(footer({ addressSource: "custom", address: "" }), designSystem);
    expect(hydrated.address).toBe("");
  });

  it("a custom name that has been emptied is not refilled while editing", () => {
    const hydrated = hydrateFooterBlockWithDesignSystem(footer({ businessNameSource: "custom", businessName: "" }), designSystem);
    expect(hydrated.businessName).toBe("");
  });

  it("the company source always follows the account", () => {
    const hydrated = hydrateFooterBlockWithDesignSystem(
      footer({ businessNameSource: "company", businessName: "Old Name", addressSource: "company", address: "Old address" }),
      designSystem,
    );
    expect(hydrated.businessName).toBe("Northfield Garden Center");
    expect(hydrated.address).toContain("12 Orchard Road");
  });

  it("older footers keep the fill-if-empty rule", () => {
    const hydrated = hydrateFooterBlockWithDesignSystem(footer({ businessName: "", address: "" }), designSystem);
    expect(hydrated.businessName).toBe("Northfield Garden Center");
    expect(hydrated.address).toContain("12 Orchard Road");
    const kept = hydrateFooterBlockWithDesignSystem(footer({ businessName: "The Potting Shed", address: "5 Mill Lane" }), designSystem);
    expect(kept.businessName).toBe("The Potting Shed");
    expect(kept.address).toBe("5 Mill Lane");
  });

  it("a custom multi-line address is shown line by line", () => {
    const out = html(footer({ addressSource: "custom", address: "Unit 4\n88 River Street\nMission, BC" }));
    expect(out).toContain("Unit 4");
    expect(out).toContain("88 River Street");
    expect(out).toContain("Mission, BC");
    expect(out).not.toContain("12 Orchard Road");
  });

  it("sender identification is never blank: an empty custom name or address shows the account's", () => {
    const out = html(footer({ businessNameSource: "custom", businessName: "", addressSource: "custom", address: "" }));
    expect(out).toContain("Northfield Garden Center");
    expect(out).toContain("12 Orchard Road");
  });

  it("phone and email lines can be hidden and shown again", () => {
    const shown = html(footer());
    expect(shown).toContain("604-555-0100");
    expect(shown).toContain("hello@northfield.example");
    const hidden = html(footer({ showFooterPhone: false, showFooterEmail: false }));
    expect(hidden).not.toContain("604-555-0100");
    expect(hidden).not.toContain("hello@northfield.example");
    expect(hidden).toContain("12 Orchard Road");
  });

  it("the unsubscribe link stays whatever the business details say", () => {
    const out = html(footer({ businessNameSource: "custom", businessName: "", showFooterPhone: false, showFooterEmail: false }));
    expect(out.toLowerCase()).toContain("unsubscribe");
  });

  it("reads the source of an older footer from its content", () => {
    expect(footerDetailSource(undefined, "", "Northfield")).toBe("company");
    expect(footerDetailSource(undefined, "Northfield", "Northfield")).toBe("company");
    expect(footerDetailSource(undefined, "The Potting Shed", "Northfield")).toBe("custom");
    expect(footerDetailSource("custom", "", "Northfield")).toBe("custom");
  });
});

describe("short banners", () => {
  const banner = (maxHeight: number) =>
    renderNewsletterBlock({
      ...createStudioBlock("graphic-hero"),
      id: "g",
      order: 0,
      visible: true,
      imageUrl: "https://example.com/banner.jpg",
      imageFit: "cover",
      maxHeight,
    } as StudioBlock);

  it("a 150px Photo Banner is drawn 150px tall, not stretched to 200", () => {
    expect(banner(150)).toContain('height="150"');
    expect(banner(150)).not.toContain('height="200"');
  });

  it("still refuses heights too small to show anything", () => {
    expect(banner(10)).toContain(`height="${MIN_BANNER_HEIGHT}"`);
  });
});
