import { describe, expect, it } from "vitest";
import {
  isFooterSocialVisible,
  normalizeSocialLinks,
  resolveFooterSocialIcon,
  resolveSocialFollowIcon,
  socialIconSrc,
} from "@/lib/studio/socialIcons";
import {
  renderFooterBlockToEmailHtml,
  renderStudioBlocksToEmailHtml,
} from "@/lib/studio/emailHtmlGenerator";
import {
  composeSocialIcon,
  parseSocialIconRequest,
  renderSocialIconPng,
} from "../../../../api/_lib/socialIconPng.js";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import type { CompanyInfo } from "@/types/company";
import type { StudioBlock } from "@/types/studioBlocks";

const links = [
  { platform: "facebook", url: "https://facebook.com/northfield", enabled: true },
  { platform: "instagram", url: "https://instagram.com/northfield", enabled: true },
  { platform: "linkedin", url: "https://linkedin.com/company/northfield", enabled: true },
  { platform: "pinterest", url: "https://pinterest.com/northfield", enabled: true },
] as StudioBlock["footerSocialLinks"];

function footer(fields: Partial<StudioBlock>): StudioBlock {
  return {
    id: "footer",
    type: "footer",
    label: "Footer",
    order: 0,
    visible: true,
    layout: "standard-dark",
    backgroundColor: "#1d6877",
    businessName: "Northfield Garden Center",
    showSocialInFooter: true,
    footerSocialLinks: links,
    ...fields,
  } as StudioBlock;
}

function social(fields: Partial<StudioBlock>): StudioBlock {
  return {
    id: "social",
    type: "social-follow",
    label: "Social Media Links",
    order: 0,
    visible: true,
    socialLinks: links,
    ...fields,
  } as StudioBlock;
}

const iconSrcs = (html: string) =>
  [...html.matchAll(/<img src="([^"]*social-icon[^"]*)"/g)].map((m) => m[1]);

describe("social icons: Show Social Icons switch", () => {
  // Brand settings with social links: the case where "off" used to be ignored.
  const ds = buildStudioDesignSystem({
    name: "Northfield", address: "", streetAddress: "", city: "", stateProvince: "",
    postalCode: "", country: "", phone: "", email: "", websiteUrl: "https://northfield.example",
    facebookUrl: "https://facebook.com/northfield", instagramUrl: "https://instagram.com/northfield",
  } as CompanyInfo);

  it("off removes the social row from sent HTML even when brand settings have links", () => {
    expect(ds.social.hasConfiguredLinks).toBe(true);
    expect(isFooterSocialVisible(footer({ showSocialInFooter: false }), true)).toBe(false);
    const html = renderFooterBlockToEmailHtml(footer({ showSocialInFooter: false }), {}, ds);
    expect(iconSrcs(html)).toEqual([]);
    expect(html).not.toContain("facebook");
  });

  it("on renders one icon per enabled link", () => {
    const html = renderFooterBlockToEmailHtml(footer({ showSocialInFooter: true }), {}, ds);
    expect(iconSrcs(html)).toHaveLength(4);
  });

  it("never-set follows brand settings", () => {
    expect(isFooterSocialVisible(footer({ showSocialInFooter: undefined }), true)).toBe(true);
    expect(isFooterSocialVisible(footer({ showSocialInFooter: undefined }), false)).toBe(false);
  });
});

describe("social icons: style x colour (footer)", () => {
  const cases: Array<[StudioBlock["footerIconStyle"], Partial<StudioBlock>, string]> = [
    ["minimal", { footerIconColor: "#E76F51", footerIconColorPicked: true }, "/social-icon/facebook/minimal/e76f51.png"],
    ["outlined", { footerIconColor: "#E76F51", footerIconColorPicked: true }, "/social-icon/facebook/outlined/e76f51.png"],
    ["filled", { footerIconColor: "#E76F51", footerIconColorPicked: true }, "/social-icon/facebook/filled/e76f51.png"],
    // Filled without a picked colour keeps the brand icon.
    ["filled", { footerIconColor: "#cbd5e1" }, "/social-icons/facebook.png"],
    // Minimal/outlined without any colour contrast with the dark footer.
    ["minimal", { footerIconColor: undefined }, "/social-icon/facebook/minimal/ffffff.png"],
    ["outlined", { footerIconColor: undefined, backgroundColor: "#ffffff" }, "/social-icon/facebook/outlined/1f2937.png"],
  ];

  it.each(cases)("%s %o -> %s", (style, fields, expected) => {
    const block = footer({ footerIconStyle: style, ...fields });
    const { src } = resolveFooterSocialIcon(block, "facebook", block.backgroundColor);
    expect(src).toBe(`https://bloomsuite.app${expected}`);
    const html = renderFooterBlockToEmailHtml(block, {});
    expect(iconSrcs(html)[0]).toBe(`https://bloomsuite.app${expected}`);
  });

  it("a non-default saved colour counts as picked (QA footer #E76F51)", () => {
    const block = footer({ footerIconStyle: "filled", footerIconColor: "#E76F51", linkColor: "#ffffff" });
    expect(resolveFooterSocialIcon(block, "linkedin", "#1d6877").src).toContain("/filled/e76f51.png");
  });

  it("never renders lettermarks or SVG", () => {
    for (const style of ["filled", "outlined", "minimal"] as const) {
      const html = renderFooterBlockToEmailHtml(footer({ footerIconStyle: style, footerIconColor: "#E76F51" }), {});
      expect(html).not.toMatch(/<svg|>\s*(F|I|in|P)\s*</);
      expect(html).not.toContain("filter:");
    }
  });
});

describe("social icons: Social Media Links colour modes", () => {
  it.each([
    [{ iconStyle: "filled", iconColorMode: "brand" }, "/social-icons/instagram.png"],
    [{ iconStyle: "outlined", iconColorMode: "brand" }, "/social-icon/instagram/outlined/c13584.png"],
    [{ iconStyle: "minimal", iconColorMode: "custom", customIconColor: "#1d6877" }, "/social-icon/instagram/minimal/1d6877.png"],
    [{ iconStyle: "filled", iconColorMode: "custom", customIconColor: "#1d6877" }, "/social-icon/instagram/filled/1d6877.png"],
    [{ iconStyle: "square", iconColorMode: "brand" }, "/social-icon/instagram/square/c13584.png"],
  ] as Array<[Partial<StudioBlock>, string]>)("%o -> %s", (fields, expected) => {
    expect(resolveSocialFollowIcon(social(fields), "instagram", "#111827").src).toBe(
      `https://bloomsuite.app${expected}`,
    );
  });
});

describe("social icons: panel order everywhere", () => {
  it("keeps array order", () => {
    expect(normalizeSocialLinks(links).map((l) => l.platform)).toEqual([
      "facebook", "instagram", "linkedin", "pinterest",
    ]);
  });

  it("restores the panel order from the saved legacy object, whose jsonb key order differs", () => {
    // The order Postgres returned for the QA campaign.
    const stored = {
      tiktok: { url: "", enabled: false },
      facebook: { url: "https://facebook.com", enabled: true },
      linkedin: { url: "https://linkedin.com", enabled: true },
      instagram: { url: "https://instagram.com", enabled: true },
    };
    expect(normalizeSocialLinks(stored).filter((l) => l.enabled).map((l) => l.platform)).toEqual([
      "facebook", "instagram", "linkedin",
    ]);
    expect(
      normalizeSocialLinks(stored, ["linkedin", "facebook", "instagram", "tiktok"])
        .filter((l) => l.enabled)
        .map((l) => l.platform),
    ).toEqual(["linkedin", "facebook", "instagram"]);
  });

  it("sent HTML uses the panel order for the saved object form", () => {
    const block = social({
      socialLinks: {
        facebook: { url: "https://facebook.com", enabled: true },
        linkedin: { url: "https://linkedin.com", enabled: true },
        instagram: { url: "https://instagram.com", enabled: true },
      } as never,
    });
    const html = renderStudioBlocksToEmailHtml([block]);
    expect(iconSrcs(html).map((src) => src.match(/social-icons?\/(\w+)/)?.[1])).toEqual([
      "facebook", "instagram", "linkedin",
    ]);
  });
});

describe("social icon PNG route", () => {
  it("validates platform, style and colour", () => {
    expect(parseSocialIconRequest("facebook", "minimal", "E76F51")).toEqual({
      platform: "facebook", style: "minimal", color: "e76f51",
    });
    expect(parseSocialIconRequest("myspace", "minimal", "e76f51")).toBeNull();
    expect(parseSocialIconRequest("facebook", "glow", "e76f51")).toBeNull();
    expect(parseSocialIconRequest("facebook", "minimal", "red")).toBeNull();
  });

  it("returns a valid PNG", () => {
    const png = renderSocialIconPng({ platform: "linkedin", style: "outlined", color: "1d6877" });
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.length).toBeGreaterThan(200);
  });

  it("draws only the requested colour for minimal and outlined", () => {
    for (const style of ["minimal", "outlined"]) {
      const rgba = composeSocialIcon({ platform: "facebook", style, color: "e76f51" });
      let opaque = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3] === 0) continue;
        opaque += 1;
        expect([rgba[i], rgba[i + 1], rgba[i + 2]]).toEqual([0xe7, 0x6f, 0x51]);
      }
      expect(opaque).toBeGreaterThan(500);
    }
  });

  it("filled is a coloured circle with a white glyph", () => {
    const rgba = composeSocialIcon({ platform: "facebook", style: "filled", color: "e76f51" });
    const px = (x: number, y: number) => [...rgba.subarray((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
    expect(px(0, 0)[3]).toBe(0); // outside the circle
    expect(px(20, 64)).toEqual([0xe7, 0x6f, 0x51, 255]); // circle body
    const pixels = Array.from({ length: 128 * 128 }, (_, i) => [...rgba.subarray(i * 4, i * 4 + 4)]);
    expect(pixels.some(([r, g, b, a]) => r === 255 && g === 255 && b === 255 && a === 255)).toBe(true);
  });

  it("socialIconSrc only uses brand PNGs for filled without a colour", () => {
    expect(socialIconSrc("facebook", "filled", null)).toBe("https://bloomsuite.app/social-icons/facebook.png");
    expect(socialIconSrc("twitter", "filled", null)).toBe("https://bloomsuite.app/social-icon/twitter/filled/111111.png");
  });
});
