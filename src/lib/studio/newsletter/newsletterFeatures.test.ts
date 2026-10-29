import { describe, it, expect } from "vitest";
import { createStudioBlock } from "../blockFactory";
import {
  generateEmailHtml,
  renderNewsletterBlock,
} from "../emailHtmlGenerator";
import { BLOCK_CATEGORIES } from "@/components/crm/studio/blockLibraryData";
import { blockMatchesAudience } from "./audience";
import {
  couponOfferLabel,
  validUpcA,
  youtubeVideoId,
} from "./renderExtensions";
import { upcABits } from "./barcode";
import {
  emailColor,
  emailFont,
  mergeAppearance,
  normalizeNewsletterSettings,
  resolveAssetUrl,
  safeEmailUrl,
} from "./settings";
import {
  inferImportMapping,
  parseDelimited,
  parseJsonFeed,
  rowsFromMatrix,
  publicFeedUrl,
  importRowsToBlocks,
} from "./dataImport";
import {
  cloneSavedBlock,
  readSavedBlock,
  savedBlockName,
  readBrowserSavedBlocks,
} from "./savedBlocks";
import { normalizeStoreMergeFields } from "./mergeFields";
import type { StudioBlock, BlockType } from "@/types/studioBlocks";
const block = (
  type: BlockType,
  patch: Partial<StudioBlock> = {},
): StudioBlock => ({ ...createStudioBlock(type), ...patch });
const html = (
  blocks: StudioBlock[],
  extra: Partial<Parameters<typeof generateEmailHtml>[0]> = {},
) =>
  generateEmailHtml({
    blocks,
    subject: "Test",
    previewText: "",
    footer: null,
    ...extra,
  });

describe("newsletter design and safety", () => {
  it("creates every registered block with a unique id and serializable data", () => {
    const blocks = BLOCK_CATEGORIES.flatMap((category) => category.blocks).map(
      (definition) => createStudioBlock(definition.type),
    );
    expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length);
    for (const b of blocks) {
      expect(JSON.parse(JSON.stringify(b)).type).toBe(b.type);
      expect(() => renderNewsletterBlock(b)).not.toThrow();
    }
  });
  it("keeps legacy defaults and accepts 700px designs", () => {
    expect(normalizeNewsletterSettings(null).width).toBe(640);
    const output = html([block("headline", { headline: "Wide email" })], {
      newsletterSettings: {
        version: 1,
        width: 700,
        blockGap: 24,
        backgroundColor: "#eeeeee",
      },
    });
    expect(output).toContain('width="700"');
    expect(output).toContain("max-width:700px");
    expect(output).toContain("background-color:#eeeeee");
  });
  it("omits the inter-block spacer when the gap is set to zero", () => {
    const output = html([block("newsletter-header", { headline: "Header" }), block("plain-text", { body: "Text" })], {
      newsletterSettings: { version: 1, blockGap: 0 },
    });
    expect(output).not.toContain('class="email-block-gap"');
  });
  it("renders an optional text-block button with its label and destination", () => {
    const output = html([block("plain-text", { body: "Hello", buttonText: "Learn more", buttonUrl: "https://example.com/learn" })]);
    expect(output).toContain('href="https://example.com/learn"');
    expect(output).toContain('Learn more');
    expect(renderNewsletterBlock(block("plain-text", { body: "Hello" }))).not.toContain('<a ');
  });
  it("round-trips master settings in the persisted footer", () => {
    const footer = block("footer", {
      newsletterSettings: {
        version: 1,
        width: 700,
        defaults: { text: { body: { size: 18 } } },
      },
    });
    expect(html([block("plain-text", { body: "Copy" }), footer])).toContain(
      "max-width:700px",
    );
  });
  it("keeps individual padding and typography stronger than defaults", () => {
    const merged = mergeAppearance(
      {
        padding: { top: 20, bottom: 20 },
        text: { body: { size: 16, color: "#000000" } },
      },
      { padding: { top: 5 }, text: { body: { size: 21 } } },
    );
    expect(merged.padding).toEqual({ top: 5, bottom: 20 });
    expect(merged.text?.body).toEqual({ size: 21, color: "#000000" });
  });
  it("does not invent padding when only typography is set", () =>
    expect(
      mergeAppearance(undefined, { text: { body: { size: 18 } } }).padding,
    ).toBeUndefined());
  it("clamps unsafe dimensions and CSS values", () => {
    expect(
      normalizeNewsletterSettings({ width: 10000, blockGap: -10 }).width,
    ).toBe(800);
    expect(normalizeNewsletterSettings({ blockGap: -10 }).blockGap).toBe(0);
    expect(emailColor("red;background:url(javascript:x)", "#ffffff")).toBe(
      "#ffffff",
    );
    expect(emailFont("Arial; background:red")).not.toContain(";");
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://u:p@example.com/a",
    "//evil.test/a",
    "http://example.com/\u0000",
  ])("rejects unsafe URL %s", (url) => expect(safeEmailUrl(url)).toBe(""));
  it("resolves filename locations without allowing traversal", () => {
    expect(resolveAssetUrl("spring.jpg", "https://example.com/images/")).toBe(
      "https://example.com/images/spring.jpg",
    );
    expect(resolveAssetUrl("../secret", "https://example.com/images/")).toBe(
      "",
    );
    expect(
      resolveAssetUrl("%2e%2e/secret", "https://example.com/images/"),
    ).toBe("");
  });
  it("renders safe content without scripts and escapes title markup", () => {
    const output = html([
      block("headline", { headline: "<img src=x onerror=alert(1)>" }),
      block("coupon", { body: "<script>alert(1)</script><p>Safe</p>" }),
    ]);
    expect(output).not.toContain("<script");
    expect(output).not.toContain("<img src=x");
    expect(output).toContain("&lt;img");
  });
  it("sets explicit margin, border and transparent background", () => {
    const output = renderNewsletterBlock(
      block("headline", {
        headline: "Special",
        appearance: {
          margin: { top: 4, right: 6, bottom: 8, left: 10 },
          padding: { top: 12 },
          border: {
            style: "dotted",
            width: 3,
            color: "#123456",
            legend: "Offers",
          },
          background: "transparent",
        },
      }),
    );
    expect(output).toContain("padding:4px 6px 8px 10px");
    expect(output).toContain("border:3px dotted #123456");
    expect(output).toContain("background-color:transparent");
    expect(output).toContain("Offers");
  });
});
describe("coupon presets and products", () => {
  it.each([
    ["price", { couponPrice: "$14.99" }, "$14.99"],
    ["percent", { couponPercent: 30 }, "30% OFF"],
    ["amount", { couponAmount: "$5" }, "$5 OFF"],
    ["bogo", {}, "Buy one, get one free"],
    ["buy-x-get-one", { couponBuyQuantity: 4 }, "Buy 4, get 1 free"],
    [
      "multi-buy",
      { couponBundleQuantity: 3, couponBundlePrice: "$20" },
      "3 for $20",
    ],
    [
      "tiered",
      { couponPrice: "$5", couponMinimumQuantity: 3, couponRegularPrice: "$7" },
      "$5 each when you buy 3 or more; otherwise $7 each",
    ],
  ] as const)("formats %s offer", (offer, patch, expected) =>
    expect(
      couponOfferLabel(block("coupon", { couponOffer: offer, ...patch })),
    ).toBe(expected),
  );
  it("puts coupon conditions and expiry after the CTA", () => {
    const output = renderNewsletterBlock(
      block("coupon", {
        headline: "Skimmia",
        subheading: "Skimmia japonica",
        buttonText: "Get offer",
        buttonUrl: "https://example.com/offer",
        couponConditions: "In store only",
        couponExpiry: "October 31",
        originalPrice: "$39.99",
        couponSizing: "#2 pot only",
      }),
    );
    expect(output.indexOf("Get offer")).toBeLessThan(
      output.indexOf("In store only"),
    );
    expect(output).toContain("Expires: October 31");
    expect(output).toContain("<s>$39.99</s>");
    expect(output).toContain("Skimmia japonica");
  });
  it("supports product subtitles, three badges and image on top", () => {
    const output = renderNewsletterBlock(
      block("product-card", {
        productName: "Dogwood",
        productSubtitle: "Cornus kousa",
        imageUrl: "https://example.com/image.jpg",
        imagePosition: "top",
        badges: ["New", "Rare", "Popular"].map((label) => ({
          id: label,
          label,
        })),
      }),
    );
    expect(output).toContain("Cornus kousa");
    for (const label of ["New", "Rare", "Popular"])
      expect(output).toContain(label);
    expect(output.indexOf("<img")).toBeLessThan(output.indexOf("Dogwood</"));
  });
  it("renders four products per row with independently linked images and alternate names", () => {
    const output = renderNewsletterBlock(
      block("product-gallery", {
        gridColumns: 4,
        galleryProducts: Array.from({ length: 4 }, (_, i) => ({
          id: String(i),
          name: `Product ${i}`,
          altName: `Latin ${i}`,
          price: "$10",
          imageUrl: `https://example.com/${i}.jpg`,
          linkUrl: `https://example.com/products/${i}`,
        })),
      }),
    );
    expect(output).toContain('width="25%"');
    expect(output).toContain("Latin 3");
    expect(output).toContain('href="https://example.com/products/3"');
    expect(output).toContain('data-newsletter-index="3"');
  });
  it("exposes all feature-grid image slots to consistent image editing", () => {
    const output = renderNewsletterBlock(
      block("image-gallery", {
        layout: "feature-grid",
        galleryImages: [0, 1, 2].map((i) => ({
          id: String(i),
          url: `https://example.com/${i}.jpg`,
          alt: `Picture ${i}`,
        })),
      }),
    );
    for (const i of [0, 1, 2])
      expect(output).toContain(`data-newsletter-index="${i}"`);
  });
  it("checks UPC-A and generates exactly 95 barcode modules", () => {
    expect(validUpcA("036000291452")).toBe(true);
    expect(validUpcA("036000291453")).toBe(false);
    expect(upcABits("036000291452")).toHaveLength(95);
    expect(upcABits("036000291452").slice(0, 3)).toBe("101");
    expect(() => upcABits("bad")).toThrow();
  });
});
describe("new email-safe blocks", () => {
  it("uses visible preheader as inbox fallback", () => {
    const output = html([
      block("preheader", { body: "A preview for readers" }),
    ]);
    expect(
      output.match(/A preview for readers/g)?.length,
    ).toBeGreaterThanOrEqual(2);
  });
  it.each(["h1", "h2", "h3", "h4", "h5", "h6"] as const)(
    "renders semantic %s headings",
    (level) => {
      expect(
        renderNewsletterBlock(
          block("headline", { headline: "Title", headingLevel: level }),
        ),
      ).toContain(`<${level}`);
    },
  );
  it("uses a linked video thumbnail rather than an iframe", () => {
    const output = renderNewsletterBlock(
      block("youtube", { videoUrl: "https://youtu.be/dQw4w9WgXcQ" }),
    );
    expect(output).toContain("youtube.com/watch?v=dQw4w9WgXcQ");
    expect(output).toContain("i.ytimg.com");
    expect(output).not.toContain("<iframe");
    expect(youtubeVideoId("https://evil.test/dQw4w9WgXcQ")).toBeNull();
  });
  it("creates a three-button row with safe links only", () => {
    const output = renderNewsletterBlock(
      block("button-group", {
        links: [
          { id: "1", label: "Shop", url: "https://example.com/shop" },
          { id: "2", label: "Events", url: "https://example.com/events" },
          { id: "3", label: "Unsafe", url: "javascript:alert(1)" },
        ],
      }),
    );
    expect(output).toContain("Shop");
    expect(output).toContain("Events");
    expect(output).not.toContain("Unsafe");
  });
  it("renders accessible data table headers and safe bar charts", () => {
    const output = html([
      block("data-table", {
        tableCaption: "Hours",
        tableHeaders: ["Day", "Open"],
        tableRows: [["Monday", "9:00"]],
      }),
      block("chart", {
        headline: "Sales",
        chartData: [
          { label: "Plants", value: 20 },
          { label: "Soil", value: 10 },
        ],
      }),
    ]);
    expect(output).toContain("<caption");
    expect(output).toContain('scope="col"');
    expect(output).toContain("Monday");
    expect(output).toContain("Plants");
    expect(output).not.toContain("<canvas");
  });
  it("renders a survey as links without an unsupported form", () => {
    const output = renderNewsletterBlock(
      block("survey", {
        headline: "What should we stock?",
        links: [
          { id: "1", label: "Roses", url: "https://example.com/poll/roses" },
        ],
      }),
    );
    expect(output).toContain("Roses");
    expect(output).not.toContain("<form");
  });
});
describe("conditional blocks and store merge fields", () => {
  const restricted = block("plain-text", {
    body: "Members-only offer",
    audience: { mode: "segments", segmentIds: ["members"] },
  });
  it("fails closed when membership is unavailable", () => {
    expect(blockMatchesAudience(restricted)).toBe(false);
    expect(html([restricted])).not.toContain("Members-only offer");
  });
  it("shows only matching segment content", () => {
    expect(
      html([restricted], { audience: { segmentIds: ["members"] } }),
    ).toContain("Members-only offer");
    expect(
      html([restricted], { audience: { segmentIds: ["other"] } }),
    ).not.toContain("Members-only offer");
  });
  it("keeps all blocks visible for explicit editing preview", () =>
    expect(html([restricted], { audience: { previewAll: true } })).toContain(
      "Members-only offer",
    ));
  it("never hides the compliance footer for a conditional audience", () =>
    expect(
      blockMatchesAudience(
        block("footer", { audience: { mode: "segments", segmentIds: [] } }),
      ),
    ).toBe(true));
  it("resolves Store aliases including explicit defaults", () => {
    expect(
      normalizeStoreMergeFields(
        '{{Store.Name}} {{Store.Phone | default: "Call us"}}',
      ),
    ).toContain("company.name");
    const output = html(
      [block("headline", { headline: "Visit {{Store.Name}}" })],
      { mergeData: { "company.name": "Garden Centre" } },
    );
    expect(output).toContain("Visit Garden Centre");
  });
});
describe("import safeguards", () => {
  it("reads quoted CSV, line breaks, escaped quotes and BOM", () => {
    const rows = parseDelimited(
      '\ufeffName,Description\r\n"Rose, red","A ""special""\nplant"',
    );
    expect(rows[0].Name).toBe("Rose, red");
    expect(rows[0].Description).toBe('A "special"\nplant');
  });
  it("reads TSV and typed spreadsheet cells", () => {
    expect(parseDelimited("Name\tPrice\nRose\t12")[0].Price).toBe("12");
    expect(
      rowsFromMatrix([
        ["Date", "Price"],
        [new Date("2026-10-27T00:00:00Z"), 19.99],
      ])[0],
    ).toEqual({ Date: "2026-10-27", Price: "19.99" });
  });
  it("rejects malformed and oversized imports", () => {
    expect(() => parseDelimited('Name\n"Unclosed')).toThrow();
    expect(() => parseDelimited("Name,Name\nA,B")).toThrow();
    expect(() => parseJsonFeed("{bad}")).toThrow();
    expect(() => parseJsonFeed('[{"name":{"nested":true}}]')).toThrow();
    expect(() =>
      parseDelimited("Name\n" + Array(101).fill("A").join("\n")),
    ).toThrow();
  });
  it("does not permit prototype pollution from JSON headers", () => {
    const rows = parseJsonFeed('[{"__proto__":"plain text","Name":"Rose"}]');
    expect(Object.getPrototypeOf(rows[0])).toBeNull();
    expect(rows[0].Name).toBe("Rose");
  });
  it.each([
    "http://example.com/feed",
    "https://127.0.0.1/feed",
    "https://localhost/a",
    "https://printer.local/a",
    "https://10.0.0.1/a",
    "https://[::1]/a",
  ])("rejects private or insecure feed %s", (url) =>
    expect(() => publicFeedUrl(url)).toThrow(),
  );
  it("maps products into independent gallery rows", () => {
    const rows = parseDelimited(
      "Name,Botanical Name,Price,Image URL,Product URL\nRose,Rosa,$19,https://example.com/a.jpg,https://example.com/a\nFern,Dryopteris,$9,https://example.com/b.jpg,https://example.com/b",
    );
    const mapping = inferImportMapping(Object.keys(rows[0]));
    const blocks = importRowsToBlocks(
      rows,
      "product-gallery",
      mapping,
      null,
      1,
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].galleryProducts?.[0].altName).toBe("Rosa");
    expect(blocks[0].id).not.toBe(blocks[1].id);
  });
  it("rejects unsafe image links before inserting cards", () => {
    const rows = [{ Name: "Rose", Image: "javascript:alert(1)" }];
    expect(() =>
      importRowsToBlocks(rows, "coupon", { title: "Name", image: "Image" }),
    ).toThrow();
  });
});
describe("named Saved Blocks", () => {
  it("deep clones gallery content and assigns fresh nested IDs", () => {
    const original = block("product-gallery", {
      label: "Spring offers",
      galleryProducts: [
        { id: "old", name: "Rose", price: "$19", imageUrl: "" },
      ],
    });
    const copy = cloneSavedBlock(original);
    copy.galleryProducts![0].name = "Changed";
    expect(original.galleryProducts![0].name).toBe("Rose");
    expect(copy.id).not.toBe(original.id);
    expect(copy.galleryProducts![0].id).not.toBe("old");
    expect(copy.label).toBe("Spring offers");
  });
  it("rejects unknown types and footer snapshots", () => {
    expect(readSavedBlock({ type: "<script>" })).toBeNull();
    expect(readSavedBlock(block("footer"))).toBeNull();
    expect(
      readSavedBlock({
        ...block("product-gallery"),
        galleryProducts: "malformed",
      }),
    ).toBeNull();
  });
  it("validates names and handles disabled browser storage", () => {
    expect(savedBlockName(" Spring lawn ")).toBe("Spring lawn");
    expect(() => savedBlockName(" ")).toThrow();
    expect(
      readBrowserSavedBlocks({
        getItem() {
          throw new Error("Blocked");
        },
      }),
    ).toEqual([]);
  });
});
