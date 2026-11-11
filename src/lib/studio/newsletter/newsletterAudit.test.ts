import { describe, it, expect } from "vitest";
import { createStudioBlock } from "../blockFactory";
import {
  generateEmailHtml,
  renderNewsletterBlock,
} from "../emailHtmlGenerator";
import { buildStudioDesignSystem } from "../designSystem";
import { normalizeContentBlocks } from "../../../../supabase/functions/_shared/campaignEmailSource";
import {
  importRowsToBlocks,
  inferImportMapping,
  rowsFromMatrix,
} from "./dataImport";
import { readSavedBlock } from "./savedBlocks";
import { mergeAppearance } from "./settings";
import type { StudioBlock } from "@/types/studioBlocks";
const b = (
  type: StudioBlock["type"],
  patch: Partial<StudioBlock> = {},
): StudioBlock => ({ ...createStudioBlock(type), ...patch });
const email = (
  blocks: StudioBlock[],
  extra: Partial<Parameters<typeof generateEmailHtml>[0]> = {},
) =>
  generateEmailHtml({
    blocks,
    subject: "Audit",
    previewText: "",
    footer: null,
    ...extra,
  });
const doc = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");
describe("newsletter bug audit", () => {
  it("does not leak hidden preview text into the inbox preheader", () =>
    expect(
      email([b("preheader", { body: "HIDDEN-PREVIEW", visible: false })]),
    ).not.toContain("HIDDEN-PREVIEW"));
  it("does not leak segment-only preview text to nonmembers", () =>
    expect(
      email(
        [
          b("preheader", {
            body: "MEMBER-ONLY-OFFER",
            audience: { mode: "segments", segmentIds: ["vip"] },
          }),
        ],
        { audience: { segmentIds: [] } },
      ),
    ).not.toContain("MEMBER-ONLY-OFFER"));
  it("still includes a permitted recipient preheader", () =>
    expect(
      email(
        [
          b("preheader", {
            body: "VIP-preview",
            audience: { mode: "segments", segmentIds: ["vip"] },
          }),
        ],
        { audience: { segmentIds: ["vip"] } },
      ),
    ).toContain("VIP-preview"));
  it("preserves deliberately cleared content through server normalization", () => {
    const [block] = normalizeContentBlocks([
      {
        ...b("email-safe-hero"),
        headline: "",
        body: "",
        title: "Hero placeholder",
        content: "Old body",
      },
    ]);
    expect(block.headline).toBe("");
    expect(block.body).toBe("");
  });
  it("still upgrades legacy title/body fields when modern fields are absent", () => {
    const [block] = normalizeContentBlocks([
      { id: "legacy", type: "text", title: "Old heading", content: "Old body" },
    ]);
    expect(block.headline).toBe("Old heading");
    expect(block.body).toBe("Old body");
  });
  it("does not send a Logo placeholder when no logo is selected", () =>
    expect(
      doc(
        renderNewsletterBlock(
          b("newsletter-header", { headline: "Garden news", logoUrl: "" }),
        ),
      ).body.textContent,
    ).not.toContain("Logo"));
  it("honours a zero block gap without a CSS minimum of 16px", () => {
    const output = email(
      [
        b("headline", { headline: "First" }),
        b("headline", { headline: "Second" }),
      ],
      { newsletterSettings: { version: 1, blockGap: 0 } },
    );
    expect(output).not.toMatch(/\.email-block-gap\s*\{[^}]*height:16px/);
  });
  it("uses account headline branding in new blocks", () => {
    const brand = buildStudioDesignSystem({} as never);
    brand.typography.headline = {
      ...brand.typography.headline,
      fontFamilyCss: "Georgia, Times, serif",
    };
    const node = doc(
      renderNewsletterBlock(
        b("headline", { headline: "Brand heading" }),
        brand,
      ),
    ).querySelector<HTMLHeadingElement>("h2")!;
    expect(node.style.fontFamily).toBe("Georgia, Times, serif");
  });
  it("keeps gallery description and original-price visibility switches", () => {
    const output = renderNewsletterBlock(
      b("product-gallery", {
        showDescription: false,
        showOriginalPrice: false,
        galleryProducts: [
          {
            id: "p",
            name: "Fern",
            imageUrl: "",
            price: "$12",
            originalPrice: "$25",
            description: "SHOULD-BE-HIDDEN",
          },
        ],
      }),
    );
    expect(output).not.toContain("SHOULD-BE-HIDDEN");
    expect(output).not.toContain("$25");
  });
  it("does not serialize unvalidated button link decoration as HTML attributes", () => {
    const output = renderNewsletterBlock(
      b("button-group", {
        buttonStyle: "link",
        links: [{ id: "a", label: "Visit", url: "https://example.com" }],
        appearance: {
          linkDecoration: 'none;" onpointerover="alert(1)' as never,
        },
      }),
    );
    expect(doc(output).querySelector("[onpointerover]")).toBeNull();
  });
  it("rejects data-table imports above the renderer column limit instead of silently losing columns", () => {
    const headers = Array.from({ length: 13 }, (_, i) => `Column${i}`);
    const rows = rowsFromMatrix([headers, headers.map(() => "value")]);
    expect(() => importRowsToBlocks(rows, "data-table", {})).toThrow(
      /12 columns/i,
    );
  });
  it("preserves imported coupon badges", () => {
    const rows = [{ title: "Fern", price: "$12", badge: "Rare" }];
    const [block] = importRowsToBlocks(
      rows,
      "coupon",
      inferImportMapping(Object.keys(rows[0])),
    );
    expect(renderNewsletterBlock(block)).toContain("Rare");
  });
  it("refuses unrecognized coupon offers instead of silently converting the price meaning", () => {
    const rows = [{ title: "Fern", price: "$12", offer: "mystery discount" }];
    expect(() =>
      importRowsToBlocks(
        rows,
        "coupon",
        inferImportMapping(Object.keys(rows[0])),
      ),
    ).toThrow(/offer/i);
  });
  it("rejects malformed saved gallery text rather than crashing when it is rendered", () => {
    expect(
      readSavedBlock(
        b("image-gallery", {
          galleryImages: [
            {
              id: "x",
              url: "https://example.com/a.png",
              alt: { bad: true } as never,
            },
          ],
        }),
      ),
    ).toBeNull();
  });
  it("enforces saved block limits in UTF-8 bytes", () =>
    expect(
      readSavedBlock(b("plain-text", { body: "🌱".repeat(65000) })),
    ).toBeNull());
});

describe("newsletter appearance compatibility", () => {
  it("changing only a heading colour does not reset its size or weight", () => {
    const output = renderNewsletterBlock(
      b("headline", {
        headline: "Only colour",
        appearance: { text: { heading: { color: "#123456" } } },
      }),
    );
    const heading = doc(output).querySelector<HTMLHeadingElement>("h2")!;
    expect(heading.style.fontSize).toBe("26px");
    expect(heading.style.fontWeight).toBe("700");
    expect(heading.style.color).toBe("rgb(18, 52, 86)");
  });
  it("choosing a master font preserves block-specific heading sizes", () => {
    const output = renderNewsletterBlock(
      b("headline", { headline: "New font" }),
      null,
      { version: 1, fontFamily: "Georgia, Times, serif" },
    );
    expect(
      doc(output).querySelector<HTMLHeadingElement>("h2")!.style.fontSize,
    ).toBe("26px");
  });
  it("cleared individual controls inherit master values before and after persistence", () => {
    const defaults = {
      padding: { top: 20 },
      text: { body: { size: 19, color: "#123456" } },
    };
    const individual = {
      padding: { top: undefined },
      text: { body: { size: undefined } },
    };
    expect(mergeAppearance(defaults, individual)).toEqual(
      mergeAppearance(defaults, JSON.parse(JSON.stringify(individual))),
    );
    expect(mergeAppearance(defaults, individual).text?.body?.size).toBe(19);
  });
  it("honours an explicitly selected 40px logo while keeping old legacy defaults", () => {
    const output = renderNewsletterBlock(
      b("newsletter-header", {
        logoSize: 40,
        logoSizeExplicit: true,
        logoUrl: "https://example.com/logo.png",
      }),
    );
    expect(
      doc(output).querySelector<HTMLImageElement>("img")!.style.height,
    ).toBe("40px");
  });
  it("explicit left image placement overrides an old top-image preset", () => {
    const output = renderNewsletterBlock(
      b("product-card", {
        imageUrl: "https://example.com/a.png",
        productName: "Fern",
        layout: "image-top",
        imagePosition: "left",
      }),
    );
    expect(output).toContain('width="38%"');
  });
  it("keeps conditional URLs discoverable for tracking without including them in recipient delivery", () => {
    const blocks = [
      b("button-group", {
        audience: { mode: "segments", segmentIds: ["vip"] },
        links: [
          { id: "v", label: "Member offer", url: "https://example.com/vip" },
        ],
      }),
    ];
    expect(email(blocks, { audience: { previewAll: true } })).toContain(
      "https://example.com/vip",
    );
    expect(email(blocks, { audience: { segmentIds: [] } })).not.toContain(
      "https://example.com/vip",
    );
  });
});
