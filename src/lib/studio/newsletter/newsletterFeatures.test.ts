import { describe, it, expect } from "vitest";
import { createStudioBlock } from "../blockFactory";
import { buildStudioDesignSystem } from "../designSystem";
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
import {
  buildImageCropKey,
  buildUnsplashCropUrl,
  resolveCroppedEmailImage,
} from "../emailImageCrop";
import { getEmailImageCropFrame } from "../emailHtmlGenerator";
import { computeCoverCropRect } from "@/components/crm/studio/useStudioImageCrops";
import {
  buildWeeklyThemeIdea,
  buildWeeklyThemeImageQuery,
  toWeeklyThemeImages,
} from "../weeklyThemeSeed";
import {
  buildNewsletterIdeaContentBlocks,
  buildNewsletterIdeaDraftSeed,
  originForNewsletterIdea,
} from "../newsletterIdeaSeed";
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
  it("uses polished spacing defaults for new blocks and newsletters", () => {
    expect(createStudioBlock("plain-text").contentPadding).toBe(24);
    expect(createStudioBlock("image-text").contentPadding).toBe(24);
    expect(createStudioBlock("divider").paddingTop).toBe(8);
    expect(normalizeNewsletterSettings(null).blockGap).toBe(12);
  });
  it("renders contained banners at natural height", () => {
    const output = renderNewsletterBlock(block("full-width-image", { imageUrl: "https://example.com/banner.png", imageFit: "contain", maxHeight: 210 }));
    expect(output).toContain("height:auto;");
    expect(output).not.toContain("responsive-crop-image");
    const cropped = renderNewsletterBlock(block("full-width-image", { imageUrl: "https://example.com/banner.png", imageFit: "cover", maxHeight: 210 }));
    expect(cropped).toContain("responsive-crop-image");
    expect(cropped).toContain('height="210"');
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
  it("uses the account primary colour for standard newsletter CTAs", () => {
    const output = renderNewsletterBlock(
      block("event", {
        headline: "Christmas workshop",
        buttonText: "Reserve a spot",
        buttonUrl: "https://example.com/event",
        buttonColor: "#545f34",
        useBrandButtonColor: true,
      }),
      buildStudioDesignSystem({
        brandPrimaryColorRaw: "#263d2d",
      } as never),
    );
    expect(output).toContain("background-color:#263d2d");
    expect(output).not.toContain("background-color:#545f34");
  });
  it.each(["event", "coupon", "image-text", "call-to-action", "button-group"] as const)(
    "honours explicitly customised button backgrounds, labels and text colours in %s",
    (type) => {
      const designSystem = buildStudioDesignSystem({
        brandPrimaryColorRaw: "#263d2d",
      } as never);
      const chosen = block(type, {
        buttonText: "View offer",
        buttonUrl: "https://example.com/offer",
        buttonColor: "#123456",
        buttonTextColor: "#fedcba",
        useBrandButtonColor: false,
        ...(type === "button-group"
          ? { links: [{ id: "link-1", label: "View offer", url: "https://example.com/offer" }] }
          : {}),
      });
      const output = renderNewsletterBlock(chosen, designSystem, {
        version: 1,
        defaults: { text: { button: { color: "#aabbcc", size: 18 } } },
      });
      const document = new DOMParser().parseFromString(output, "text/html");
      const button = Array.from(document.querySelectorAll("a")).find(
        (node) => node.textContent?.includes("View offer"),
      );
      expect(button, type).toBeTruthy();
      expect(button?.style.backgroundColor, type).toBe("rgb(18, 52, 86)");
      expect(button?.style.color, type).toBe("rgb(254, 220, 186)");
    },
  );

  it("does not override saved legacy custom CTA colours when brand-following is unspecified", () => {
    const designSystem = buildStudioDesignSystem({
      brandPrimaryColorRaw: "#263d2d",
    } as never);
    const output = renderNewsletterBlock(
      block("event", {
        buttonText: "Read more",
        buttonUrl: "https://example.com",
        buttonColor: "#123456",
        buttonTextColor: "#fedcba",
        useBrandButtonColor: undefined,
      }),
      designSystem,
    );
    const document = new DOMParser().parseFromString(output, "text/html");
    const button = document.querySelector<HTMLAnchorElement>('[data-newsletter-role="button"]');
    expect(button?.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(button?.style.color).toBe("rgb(254, 220, 186)");
  });

  it("keeps per-link text colours when a button group has newsletter typography defaults", () => {
    const output = renderNewsletterBlock(
      block("button-group", {
        useBrandButtonColor: false,
        links: [
          { id: "link-1", label: "Black text", url: "https://example.com/a", color: "#ffffff", textColor: "#000000" },
          { id: "link-2", label: "White text", url: "https://example.com/b", color: "#000000", textColor: "#ffffff" },
        ],
      }),
      undefined,
      { version: 1, defaults: { text: { button: { color: "#ff0000" } } } },
    );
    const document = new DOMParser().parseFromString(output, "text/html");
    const [first, second] = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"));
    expect(first.style.color).toBe("rgb(0, 0, 0)");
    expect(second.style.color).toBe("rgb(255, 255, 255)");
  });

  it("renders event blocks as a consistent rounded editorial card", () => {
    const output = renderNewsletterBlock(
      block("event", {
        headline: "Jingle and Mingle",
        eventDate: "Thursday, November 12",
        eventLocation: "Lacoste Garden Centre · Winnipeg",
        imageUrl: "https://example.com/christmas.jpg",
        buttonText: "View details",
        buttonUrl: "https://example.com/event",
      }),
    );
    expect(output).toContain("border-radius:14px");
    expect(output).toContain('height="252"');
    expect(output).toContain("text-transform:uppercase");
  });
  it("places right-aligned event photos after their copy without RTL reordering", () => {
    const output = renderNewsletterBlock(
      block("event", {
        headline: "Holiday Planter Parties",
        imageUrl: "https://example.com/planter.jpg",
        imagePosition: "right",
      }),
    );
    // Explicit table-cell order keeps text left-to-right on desktop and on
    // narrow email layouts. RTL previously reversed multiple client layouts.
    expect(output).not.toContain('<tr dir="rtl">');
    expect(output.indexOf("Holiday Planter Parties")).toBeLessThan(
      output.indexOf('data-newsletter-image="imageUrl"'),
    );
  });
  it("keeps image-right image/text blocks image-first for mobile clients", () => {
    const output = html([
      block("image-text", {
        headline: "Snowy favourites",
        imageUrl: "https://example.com/tree.jpg",
        layout: "image-right",
      }),
    ]);
    const document = new DOMParser().parseFromString(output, "text/html");
    const table = document.querySelector<HTMLTableElement>(".image-text-row")!;
    expect(table.dir).toBe("rtl");
    expect(table.style.direction).toBe("rtl");
    expect(table.rows[0].cells[0].classList.contains("image-text-image")).toBe(true);
    expect(Array.from(table.rows[0].cells).map((cell) => cell.dir)).toEqual(["ltr", "ltr"]);
    expect(output.indexOf('alt="Snowy favourites"')).toBeLessThan(
      output.indexOf("Snowy favourites</h1>"),
    );
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
describe("Arts Nursery November 15 Design Studio regressions", () => {
  it("allows safe bare-domain links but never makes dangerous schemes clickable", () => {
    expect(safeEmailUrl("artsnursery.com/events")).toBe("https://artsnursery.com/events");
    expect(safeEmailUrl("www.example.com/offer?code=1")).toBe("https://www.example.com/offer?code=1");
    expect(safeEmailUrl("javascript:alert(1)")).toBe("");
    expect(safeEmailUrl("//evil.test/path")).toBe("");
    expect(safeEmailUrl("example.com/script", true)).toBe("");
  });

  it.each(["event", "blog", "announcement", "coupon", "product-card"] as const)(
    "shows a draft button without a destination on %s, but never sends it",
    (type) => {
      const draft = block(type, { headline: "Fall offers", productName: "Ferns",
        buttonText: "Read more", buttonUrl: "" });
      const preview = renderNewsletterBlock(draft, undefined, undefined, { editing: true });
      const outbound = renderNewsletterBlock(draft);
      expect(preview).toContain("Read more");
      expect(preview).toContain('data-newsletter-role="button"');
      expect(outbound).not.toContain('data-newsletter-role="button"');
    },
  );

  it("keeps product gallery CTA visible in the editor and supports badge and button options", () => {
    const draft = block("product-gallery", {
      buttonAlign: "right",
      fullWidthButton: true,
      galleryProducts: [{
        id: "1", name: "Japanese Maple", price: "$39", imageUrl: "https://example.com/maple.png",
        badgeText: "Rare", badgeColor: "#123456", badgeTextColor: "#abcdef",
        buttonText: "View plant", buttonUrl: "",
        imagePadding: { top: 4, left: 8 },
      }],
    });
    const preview = renderNewsletterBlock(draft, undefined, undefined, { editing: true });
    expect(preview).toContain("View plant");
    expect(preview).toContain("text-align:right");
    expect(preview).toContain("width:100%");
    expect(preview).toContain("background:#123456;color:#abcdef");
    expect(preview).toContain("padding:4px 0px 0px 8px");
    expect(renderNewsletterBlock(draft)).not.toContain("View plant");
  });

  it("places individual gallery image margins and padding in email HTML", () => {
    const draft = block("image-gallery", { galleryImages: [
      { id: "one", url: "https://example.com/a.jpg", alt: "Maple",
        linkUrl: "artsnursery.com/maple", imagePadding: { top: 2, right: 4 },
        imageMargin: { bottom: 6 } },
    ] });
    const rendered = renderNewsletterBlock(draft);
    expect(rendered).toContain('href="https://artsnursery.com/maple"');
    expect(rendered).toContain("padding:2px 4px 0px 0px");
    expect(rendered).toContain("margin:0px 0px 6px 0px");
  });

  it("makes product layouts and badges visibly different while preserving old crops", () => {
    const newCard = createStudioBlock("product-card");
    expect(newCard.imageFit).toBe("contain");
    const draft = block("product-card", {
      productName: "Maple", badgeText: "Rare", showBadges: true,
      badgePosition: "top-right",
      imageUrl: "https://example.com/maple.jpg", imagePosition: "right",
      buttonText: "Shop", buttonUrl: "artsnursery.com/maple",
    });
    const right = renderNewsletterBlock(draft);
    expect(right).toContain("text-align:right");
    expect(right).toContain('href="https://artsnursery.com/maple"');
    expect(right).not.toContain('dir="rtl"');
    const centered = renderNewsletterBlock({ ...draft, layout: "centered", imagePosition: "top" });
    expect(centered).toContain("text-align:center");
    const minimal = renderNewsletterBlock({ ...draft, layout: "minimal" });
    expect(minimal).not.toContain("https://example.com/maple.jpg");
    expect(renderNewsletterBlock({ ...draft, imageFit: "cover" })).toContain("object-fit:cover");
  });

  it.each(["product-card", "event", "blog", "announcement", "coupon"] as const)(
    "places %s photos on the requested side in previews and outgoing HTML",
    (type) => {
      for (const editing of [true, false]) {
        for (const side of ["left", "right", "top", "left"] as const) {
          const output = renderNewsletterBlock(block(type, {
            headline: "Layout check", productName: "Layout check",
            imageUrl: "https://example.com/plant.jpg",
            imagePosition: side, couponImageSide: side,
          }), undefined, undefined, { editing });
          const doc = new DOMParser().parseFromString(output, "text/html");
          const image = doc.querySelector('img[src="https://example.com/plant.jpg"]')!;
          const cell = image.closest("td");
          if (side === "top") {
            expect(image.closest("td.responsive-column")).toBeNull();
            expect(output.indexOf('data-newsletter-image="imageUrl"')).toBeLessThan(output.indexOf('data-newsletter-role="heading"'));
          } else {
            const row = cell!.parentElement! as HTMLTableRowElement;
            expect(row.cells[side === "left" ? 0 : 1]).toBe(cell);
            expect(row.cells[side === "left" ? 1 : 0].textContent).toContain("Layout check");
          }
          expect(doc.querySelector('tr[dir="rtl"]')).toBeNull();
        }
      }
    },
  );

  it("renders saved feature product galleries beside their details in outgoing email", () => {
    const output = renderNewsletterBlock(block("product-gallery", {
      layout: "feature-product", gridColumns: 3,
      galleryProducts: [{ id: "maple", name: "Japanese maple", imageUrl: "https://example.com/maple.jpg" }],
    }));
    const doc = new DOMParser().parseFromString(output, "text/html");
    const imageCell = doc.querySelector('img[src="https://example.com/maple.jpg"]')!.closest("td")!;
    expect(imageCell.nextElementSibling?.textContent).toContain("Japanese maple");
    expect(imageCell.classList.contains("responsive-column")).toBe(true);
    expect(imageCell.nextElementSibling?.classList.contains("responsive-column")).toBe(true);
  });

  it("supports event date, time and admission without requiring a button URL", () => {
    const event = block("event", {
      headline: "Workshop", eventStartDate: "2026-12-05", eventStartTime: "14:30",
      eventFeeType: "donation", buttonText: "Reserve", buttonUrl: "",
    });
    const preview = renderNewsletterBlock(event, undefined, undefined, { editing: true });
    expect(preview).toContain("December 5, 2026");
    expect(preview).toContain("2:30 PM");
    expect(preview).toContain("By donation");
    expect(preview).toContain("Reserve");
    const outbound = renderNewsletterBlock(event);
    expect(outbound).not.toContain('data-newsletter-role="button"');
    const legacy = renderNewsletterBlock(block("event", { eventDate: "Saturday afternoon" }));
    expect(legacy).toContain("Saturday afternoon");
  });

  it("uses social icon shape, spacing and monochrome/custom colour in sent HTML", () => {
    const links: StudioBlock["socialLinks"] = [
      { platform: "facebook", url: "https://facebook.com/example", enabled: true },
      { platform: "instagram", url: "https://instagram.com/example", enabled: true },
    ];
    const mono = renderNewsletterBlock(block("social-follow", {
      socialLinks: links, iconColorMode: "custom", iconStyle: "square",
      customIconColor: "#123456", iconSpacing: 28,
    }));
    expect(mono).toContain("background-color:#123456");
    expect(mono).toContain("padding:0 14px");
    expect(mono).toContain("border-radius:5px");
    expect(mono).toContain("IG");
    const outline = renderNewsletterBlock(block("social-follow", {
      socialLinks: links, iconColorMode: "mono", iconStyle: "outlined",
      textColor: "#987654",
    }));
    expect(outline).toContain("border:1px solid #987654");
    expect(outline).toContain("href=\"https://instagram.com/example\"");
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

const cropTestUrl = "https://example.com/garden.jpg";

describe("email image crops", () => {
  it("uses a stored crop only when it was made for this frame and focal point", () => {
    const frame = { width: 640, height: 400 };
    const key = buildImageCropKey(cropTestUrl, frame, 30, 70);
    const block = { imageFocalX: 30, imageFocalY: 70, croppedImageUrl: "https://cdn.test/crop.jpg", croppedImageKey: key };
    expect(resolveCroppedEmailImage(block, cropTestUrl, frame)).toEqual({ src: "https://cdn.test/crop.jpg", cropped: true });
    expect(resolveCroppedEmailImage({ ...block, imageFocalX: 50 }, cropTestUrl, frame).cropped).toBe(false);
    expect(resolveCroppedEmailImage(block, cropTestUrl, { width: 640, height: 300 }).cropped).toBe(false);
  });

  it("never crops on its own: blocks without a stored crop render as before", () => {
    const unsplash = "https://images.unsplash.com/photo-1";
    expect(resolveCroppedEmailImage({}, unsplash, { width: 640, height: 400 })).toEqual({ src: unsplash, cropped: false });
  });

  it("builds an imgix focal-point crop for Unsplash", () => {
    const crop = new URL(buildUnsplashCropUrl("https://images.unsplash.com/photo-1?w=200&ixid=abc", { width: 640, height: 400 }, 25, 80));
    expect(crop.searchParams.get("w")).toBe("1280");
    expect(crop.searchParams.get("h")).toBe("800");
    expect(crop.searchParams.get("fit")).toBe("crop");
    expect(crop.searchParams.get("crop")).toBe("focalpoint");
    expect(crop.searchParams.get("fp-x")).toBe("0.25");
    expect(crop.searchParams.get("fp-y")).toBe("0.80");
    expect(crop.searchParams.get("ixid")).toBe("abc");
  });

  it("computes a cover crop rectangle around the focal point", () => {
    expect(computeCoverCropRect({ width: 2000, height: 1000 }, { width: 640, height: 400 }, 0, 50)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 1000 });
    expect(computeCoverCropRect({ width: 2000, height: 1000 }, { width: 640, height: 400 }, 100, 50)).toEqual({ sx: 400, sy: 0, sw: 1600, sh: 1000 });
  });

  it("renders a stored crop with natural height and no object-fit", () => {
    const base = { ...createStudioBlock("full-width-image"), imageUrl: cropTestUrl, imageFit: "cover" as const, maxHeight: 400 };
    const frame = getEmailImageCropFrame(base);
    expect(frame).toEqual({ width: 640, height: 400 });
    const legacy = renderNewsletterBlock(base);
    expect(legacy).toContain("object-fit:cover");
    expect(legacy).toContain("responsive-crop-image");

    const cropped = renderNewsletterBlock({
      ...base,
      croppedImageUrl: "https://cdn.test/crop.jpg",
      croppedImageKey: buildImageCropKey(cropTestUrl, frame!, undefined, undefined),
    });
    expect(cropped).toContain('src="https://cdn.test/crop.jpg"');
    expect(cropped).not.toContain("object-fit");
    expect(cropped).not.toContain("responsive-crop-image");
    expect(cropped).toContain("height:auto");
  });

  it("matches the image-text frame the renderer uses", () => {
    const block = { ...createStudioBlock("image-text"), imageUrl: cropTestUrl, imageRatio: "4:3" as const, imageFit: "cover" as const };
    const frame = getEmailImageCropFrame(block);
    expect(frame).not.toBeNull();
    const html = renderNewsletterBlock({
      ...block,
      croppedImageUrl: "https://cdn.test/it.jpg",
      croppedImageKey: buildImageCropKey(cropTestUrl, frame!, undefined, undefined),
    });
    expect(html).toContain('src="https://cdn.test/it.jpg"');
  });
});


const weeklyThemeTestSource = {
  weekNumber: 47,
  themeCampaignId: "3b0c0f63-1111-4222-8333-444455556666",
  title: "Holiday Greenery Prep",
  theme: "Fresh Evergreens for the Holidays",
  description: "Wreath workshops • Fresh-cut tree care • Poinsettia picks",
  seasonalFocus: "Getting homes ready for the holidays",
  images: [
    { url: "https://images.unsplash.com/photo-1?ixid=a", alt: "Wreath", credit: "" },
    { url: "https://images.unsplash.com/photo-2", alt: "Tree", credit: "" },
    { url: "https://images.unsplash.com/photo-3", alt: "Poinsettia", credit: "" },
  ],
};

describe("weekly theme seed", () => {
  it("keeps only https images", () => {
    expect(
      toWeeklyThemeImages([
        { url: "https://x.test/a.jpg", alt: "a" },
        { url: "http://x.test/b.jpg" },
        "nope",
      ]),
    ).toEqual([{ url: "https://x.test/a.jpg", alt: "a", credit: "" }]);
  });

  it("builds a photo search from the theme", () => {
    expect(buildWeeklyThemeImageQuery(weeklyThemeTestSource)).toBe("fresh evergreens holidays garden");
  });

  it("seeds a newsletter with the theme's copy and photos, tagged as theme blocks", () => {
    const idea = buildWeeklyThemeIdea(weeklyThemeTestSource);
    expect(idea.category).toBe("weekly");
    expect(idea.themeCampaignId).toBe(weeklyThemeTestSource.themeCampaignId);
    expect(originForNewsletterIdea(idea)).toBe(`weekly_theme:${weeklyThemeTestSource.themeCampaignId}`);

    const seed = buildNewsletterIdeaDraftSeed(idea, "block-builder");
    const types = seed.contentBlocks.map((block) => block.type);
    expect(types).toContain("full-width-image");
    expect(types.filter((type) => type === "image-text")).toHaveLength(2);
    expect(types.at(-1)).toBe("footer");
    const imageUrls = seed.contentBlocks.map((block) => block.imageUrl).filter(Boolean);
    expect(imageUrls).toEqual(weeklyThemeTestSource.images.map((image) => image.url));
    for (const block of seed.contentBlocks) {
      expect(block.source).toBe(block.type === "footer" ? undefined : "theme");
    }
    expect(seed.origin).toBe(`weekly_theme:${weeklyThemeTestSource.themeCampaignId}`);
  });

  it("falls back to the master week when there is no tenant theme row", () => {
    const idea = buildWeeklyThemeIdea({ ...weeklyThemeTestSource, themeCampaignId: null, images: [] });
    expect(originForNewsletterIdea(idea)).toBe("weekly_theme:master:47");
    // No photos: no empty image placeholders.
    const blocks = buildNewsletterIdeaContentBlocks(idea);
    expect(blocks.some((block) => block.type === "full-width-image")).toBe(false);
    expect(blocks.every((block) => block.source === "theme")).toBe(true);
  });
});

describe("empty blocks (#2)", () => {
  const filled = { ...createStudioBlock("plain-text"), body: "<p>Spring sale this weekend</p>" };
  const emptyText = { ...createStudioBlock("plain-text"), body: "", headline: "", buttonText: "" };
  const emptyImage = { ...createStudioBlock("full-width-image"), imageUrl: "" };
  const footer = createStudioBlock("footer");

  it("drafts leave empty blocks out entirely: no wrapper, no gap", async () => {
    const { ensureFooterBlockCompliance } = await import("../footerCompliance");
    const blocks = ensureFooterBlockCompliance([filled, emptyText, emptyImage, footer]);
    expect(blocks.find((b) => b.type === "footer")?.newsletterSettings?.emptyBlocks).toBe("skip");
    const out = generateEmailHtml({ blocks, subject: "S", previewText: "P" });
    expect(out.match(/class="email-block email-block-plain-text"/g)).toHaveLength(1);
    expect(out).not.toContain("email-block-full-width-image");
    expect(out).not.toContain('class="email-block-gap"');
  });

  it("re-renders campaigns without the flag exactly as before", () => {
    const out = generateEmailHtml({ blocks: [filled, emptyText, footer], subject: "S", previewText: "P" });
    expect(out.match(/class="email-block email-block-plain-text"/g)).toHaveLength(2);
    expect(out).toContain('class="email-block-gap"');
  });

  it("only treats content blocks as empty", async () => {
    const { isEmptyContentBlock } = await import("../emailHtmlGenerator");
    expect(isEmptyContentBlock(emptyText)).toBe(true);
    expect(isEmptyContentBlock(filled)).toBe(false);
    expect(isEmptyContentBlock({ ...emptyText, buttonText: "Shop", buttonUrl: "https://x.test" })).toBe(false);
    expect(isEmptyContentBlock(createStudioBlock("divider"))).toBe(false);
    expect(isEmptyContentBlock(createStudioBlock("spacer"))).toBe(false);
  });
});

describe("blank canvas brand defaults (#14)", () => {
  const ds = buildStudioDesignSystem({
    name: "Northfield Garden Center",
    email: "mail@northfieldgardens.ca",
    logoUrl: "https://cdn.test/logo.png",
    brandPrimaryColorRaw: "#2f6b3a",
  } as never);

  it("prefills the header with the store name and logo", () => {
    const header = createStudioBlock("newsletter-header", ds);
    expect(header.headline).toBe("Northfield Garden Center");
    expect(header.logoUrl).toBe("https://cdn.test/logo.png");
  });

  it("starts a new footer in brand colours with the business contact email", async () => {
    const { ensureFooterBlockCompliance } = await import("../footerCompliance");
    const footer = ensureFooterBlockCompliance([createStudioBlock("plain-text", ds)], { designSystem: ds })
      .find((block) => block.type === "footer")!;
    expect(footer.backgroundColor).toBe("#2f6b3a");
    expect(footer.logoUrl).toBe("https://cdn.test/logo.png");
    const html = generateEmailHtml({ blocks: [footer], subject: "S", previewText: "P", designSystem: ds });
    expect(html).toContain("mail@northfieldgardens.ca");
  });

  it("keeps the render-time fallback footer unchanged for stored campaigns", async () => {
    const { createFooterBlockFromDesignSystem } = await import("../emailHtmlGenerator");
    expect(createFooterBlockFromDesignSystem(ds).backgroundColor).toBe("#1e293b");
  });

  it("uses the brand primary for buttons on new blocks", () => {
    expect(createStudioBlock("call-to-action", ds).buttonColor).toBe("#2f6b3a");
  });
});

describe("Pick a look keeps user-set values (#20)", () => {
  it("keeps a user-chosen logo size and alignment and fills the rest from the new look", async () => {
    const { mergeLookFields, newsletterHeaderPresets } = await import("../layoutPresets");
    const defaults = createStudioBlock("newsletter-header");
    const [from, to] = newsletterHeaderPresets;
    const block = {
      ...defaults,
      ...from.fields,
      layoutPreset: from.key,
      logoSize: 96,
      logoSizeExplicit: true,
      logoAlignment: "right" as const,
    };
    const fields = mergeLookFields(block, to, newsletterHeaderPresets, defaults);
    expect(fields.layoutPreset).toBe(to.key);
    expect(fields).not.toHaveProperty("logoSize");
    if ("logoAlignment" in to.fields && to.fields.logoAlignment !== "right") {
      expect(fields).not.toHaveProperty("logoAlignment");
    }
    // Untouched fields follow the new look.
    for (const [field, value] of Object.entries(to.fields)) {
      if (["logoSize", "logoAlignment"].includes(field)) continue;
      if ((block as Record<string, unknown>)[field] === (from.fields as Record<string, unknown>)[field]) {
        expect((fields as Record<string, unknown>)[field]).toEqual(value);
      }
    }
  });

  it("applies every field of the new look when nothing was customised", async () => {
    const { mergeLookFields, imageTextPresets } = await import("../layoutPresets");
    const defaults = createStudioBlock("image-text");
    const [from, to] = imageTextPresets;
    const block = { ...defaults, ...from.fields, layoutPreset: from.key };
    expect(mergeLookFields(block, to, imageTextPresets, defaults)).toEqual({ ...to.fields, layoutPreset: to.key });
  });

  it("keeps a colour the user picked", async () => {
    const { mergeLookFields, imageTextPresets } = await import("../layoutPresets");
    const defaults = createStudioBlock("image-text");
    const [from, to] = imageTextPresets;
    const block = { ...defaults, ...from.fields, layoutPreset: from.key, backgroundColor: "#abcdef" };
    const fields = mergeLookFields(block, to, imageTextPresets, defaults);
    expect(fields).not.toHaveProperty("backgroundColor");
  });
});
