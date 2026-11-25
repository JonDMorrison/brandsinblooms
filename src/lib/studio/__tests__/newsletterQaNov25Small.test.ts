import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import { generateEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import { renderCoupon, renderExtendedBlock, withCurrencySymbol } from "@/lib/studio/newsletter/renderExtensions";
import { isSocialHomepageOnly } from "@/lib/studio/socialIcons";
import type { StudioBlock } from "@/types/studioBlocks";

const coupon = (fields: Partial<StudioBlock>) =>
  ({ ...createStudioBlock("coupon"), ...fields }) as StudioBlock;

describe("Coupon offer-type switching", () => {
  const leftovers = { couponPrice: "$19.99", originalPrice: "$29.99" };

  it.each(["25", "50", "percent", "bogo", "buy-x-get-one"] as const)(
    "%s ignores price fields left over from a sale-price offer",
    (couponOffer) => {
      const html = renderCoupon(coupon({ ...leftovers, couponOffer }), 640);
      expect(html).not.toContain("$19.99");
      expect(html).not.toContain("$29.99");
    },
  );

  it("a sale price shows the old price after the new one", () => {
    const html = renderCoupon(coupon({ ...leftovers, couponOffer: "price" }), 640);
    expect(html).toContain("$19.99");
    expect(html.indexOf("$19.99")).toBeLessThan(html.indexOf("$29.99"));
    expect(html).toMatch(/\$19\.99 <s[^>]*>\$29\.99<\/s>/);
  });

  it("switching 25% → sale price → 25% renders only what each offer uses", () => {
    let block = coupon({ couponOffer: "25" });
    expect(renderCoupon(block, 640)).toContain("25% OFF");
    block = { ...block, couponOffer: "price", ...leftovers };
    expect(renderCoupon(block, 640)).toContain("$19.99");
    block = { ...block, couponOffer: "25" };
    const html = renderCoupon(block, 640);
    expect(html).toContain("25% OFF");
    expect(html).not.toMatch(/\$19\.99|\$29\.99/);
  });

  it("tiered offers use the price but never the old price", () => {
    const html = renderCoupon(coupon({ ...leftovers, couponOffer: "tiered" }), 640);
    expect(html).toContain("$19.99 each");
    expect(html).not.toContain("$29.99");
  });
});

describe("Product Card", () => {
  const card = (fields: Partial<StudioBlock>) =>
    ({ ...createStudioBlock("product-card"), productName: "Maple", imageUrl: "https://placehold.co/600x600/png", ...fields }) as StudioBlock;

  it.each(["left", "center", "right"] as const)("aligns the button %s", (buttonAlign) => {
    const html = renderExtendedBlock(card({ buttonText: "Shop", buttonUrl: "https://x.test", buttonAlign }), 640) ?? "";
    expect(html).toContain(`text-align:${buttonAlign};`);
  });

  it("renders a bare number with the $ the price box shows", () => {
    const html = renderExtendedBlock(card({ productPrice: "29.99", originalPrice: "39" }), 640) ?? "";
    expect(html).toContain("$29.99");
    expect(html).toContain("$39");
    expect(withCurrencySymbol("€25")).toBe("€25");
    expect(withCurrencySymbol("From $10")).toBe("From $10");
  });

  it("Top layout fills the card width at the photo's own proportions", () => {
    const html = renderExtendedBlock(card({ imagePosition: "top" }), 640) ?? "";
    const img = html.match(/<img[^>]*>/)?.[0] ?? "";
    expect(img).toContain('width="592"');
    expect(img).toContain("height:auto");
    expect(img).not.toContain("height:220px");
  });
});

describe("Headline Banner default look", () => {
  it("new banners use the selected Brand Green look", () => {
    const block = createStudioBlock("email-safe-hero");
    expect(block.layoutPreset).toBe("hero-brand-green");
    expect(block.backgroundColor?.toLowerCase()).toBe("#2e7d32");
    expect(block.textColor?.toLowerCase()).toBe("#ffffff");
  });
});

describe("Event card on phones", () => {
  it("keeps padding between the card border and its words", () => {
    const block = { ...createStudioBlock("event"), headline: "Pruning workshop", tagLabel: "Workshop", imageUrl: "https://placehold.co/600x400/png", imagePosition: "left" } as StudioBlock;
    const html = generateEmailHtml({ blocks: [block] } as Parameters<typeof generateEmailHtml>[0]);
    expect(html).toContain("event-card-cell");
    expect(html).toMatch(/\.product-card-row \.event-card-cell \{ padding-left:18px !important; padding-right:18px !important; \}/);
  });
});

describe("New social blocks", () => {
  it("never start with a bare network homepage", () => {
    expect(isSocialHomepageOnly("https://facebook.com")).toBe(true);
    expect(isSocialHomepageOnly("https://www.instagram.com/")).toBe(true);
    expect(isSocialHomepageOnly("https://facebook.com/northfieldgardens")).toBe(false);
    const designSystem = buildStudioDesignSystem({
      facebookUrl: "https://facebook.com",
      instagramUrl: "https://instagram.com/northfield",
    } as Parameters<typeof buildStudioDesignSystem>[0]);
    for (const type of ["social-follow", "footer"] as const) {
      const block = createStudioBlock(type, designSystem);
      const links = (type === "footer" ? block.footerSocialLinks : block.socialLinks) ?? [];
      const facebook = links.find((link) => link.platform === "facebook");
      const instagram = links.find((link) => link.platform === "instagram");
      expect(facebook).toMatchObject({ url: "", enabled: false });
      expect(instagram).toMatchObject({ url: "https://instagram.com/northfield", enabled: true });
    }
  });
});

describe("Product Card photo proportions (Block Builder feedback)", () => {
  const card = (fields: Partial<StudioBlock>) =>
    ({ ...createStudioBlock("product-card"), productName: "Fern", imageUrl: "https://example.com/tall-540x960.jpg", imagePosition: "left", ...fields }) as StudioBlock;

  it("'Show whole photo' keeps a tall photo's proportions beside the text", () => {
    const img = (renderExtendedBlock(card({ imageFit: "contain" }), 640) ?? "").match(/<img[^>]*>/)?.[0] ?? "";
    expect(img).toContain("height:auto");
    expect(img).not.toContain("height:220px");
  });

  it("'Fill the space' still crops into the fixed box", () => {
    const img = (renderExtendedBlock(card({ imageFit: "cover" }), 640) ?? "").match(/<img[^>]*>/)?.[0] ?? "";
    expect(img).toContain("height:220px");
  });
});
