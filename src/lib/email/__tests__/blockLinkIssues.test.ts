import { describe, expect, it } from "vitest";
import {
  describeCampaignBlockLinkIssues,
  findBlockLinkIssues,
  findCampaignLinkIssues,
} from "@/lib/email/blockLinkIssues";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderNewsletterBlock } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

function block(type: StudioBlock["type"], fields: Partial<StudioBlock> = {}): StudioBlock {
  return { ...createStudioBlock(type), ...fields };
}

describe("findBlockLinkIssues", () => {
  it.each(["www shop", "htp://x", "javascript:alert(1)"])(
    "flags a button whose link is %s",
    (buttonUrl) => {
      const issues = findBlockLinkIssues(block("call-to-action", { buttonText: "Shop", buttonUrl }));
      expect(issues).toEqual([
        expect.objectContaining({ field: "buttonUrl", fieldLabel: "Button link" }),
      ]);
    },
  );

  it("flags a button with words and no link as empty", () => {
    expect(findBlockLinkIssues(block("call-to-action", { buttonText: "Shop", buttonUrl: "" }))).toEqual([
      { field: "buttonUrl", fieldLabel: "Button link", problem: "empty" },
    ]);
  });

  it("names a dangerous link as unsafe", () => {
    expect(
      findBlockLinkIssues(block("call-to-action", { buttonText: "Shop", buttonUrl: "JaVaScRiPt:alert(1)" }))[0]
        .problem,
    ).toBe("unsafe");
  });

  it.each([
    "https://yourstore.com",
    "shop.example.com",
    "mailto:hi@yourstore.com",
    "tel:+15551234567",
    "{{company.website}}",
  ])("accepts a button linking to %s", (buttonUrl) => {
    expect(findBlockLinkIssues(block("call-to-action", { buttonText: "Shop", buttonUrl }))).toEqual([]);
  });

  it("ignores buttons that do not go out", () => {
    expect(findBlockLinkIssues(block("call-to-action", { buttonText: "", buttonUrl: "" }))).toEqual([]);
    expect(
      findBlockLinkIssues(block("graphic-hero", { showButton: false, buttonText: "Shop", buttonUrl: "x" })),
    ).toEqual([]);
    expect(
      findBlockLinkIssues(block("call-to-action", { visible: false, buttonText: "Shop", buttonUrl: "x" })),
    ).toEqual([]);
  });

  it("checks image links only when one is typed", () => {
    expect(findBlockLinkIssues(block("full-width-image", { linkUrl: "" }))).toEqual([]);
    expect(findBlockLinkIssues(block("full-width-image", { linkUrl: "www shop" }))).toEqual([
      { field: "linkUrl", fieldLabel: "Image link", problem: "invalid" },
    ]);
  });

  it("checks gallery, product and button-group links", () => {
    const issues = findBlockLinkIssues(
      block("product-gallery", {
        galleryImages: [{ id: "a", url: "https://img.test/a.png", alt: "", linkUrl: "htp://x" }],
        galleryProducts: [
          { id: "p", imageUrl: "", name: "Fern", price: "$5", buttonText: "Buy", buttonUrl: "" },
        ],
      }),
    );
    expect(issues.map((issue) => issue.field)).toEqual([
      "galleryImages.0.linkUrl",
      "galleryProducts.0.buttonUrl",
    ]);
    expect(
      findBlockLinkIssues(
        block("button-group", {
          links: [
            { id: "1", label: "Shop", url: "" },
            { id: "2", label: "", url: "" },
          ],
        }),
      ),
    ).toEqual([{ field: "links.0.url", fieldLabel: "Link 1", problem: "empty" }]);
  });
});

describe("findCampaignLinkIssues", () => {
  it("lists every block with a broken link, by position", () => {
    const blocks = [
      block("call-to-action", { id: "ok", buttonText: "Shop", buttonUrl: "https://shop.com" }),
      block("call-to-action", { id: "bad", buttonText: "Shop", buttonUrl: "www shop" }),
      block("full-width-image", { id: "img", linkUrl: "javascript:alert(1)" }),
    ];
    const found = findCampaignLinkIssues(blocks);
    expect(found.map((entry) => [entry.blockId, entry.position])).toEqual([
      ["bad", 2],
      ["img", 3],
    ]);
    expect(describeCampaignBlockLinkIssues(found[0])).toMatch(
      /^Block 2 \(.+\): Button link is not a full link\. Enter a full link, like https:\/\/yourstore\.com\.$/,
    );
  });
});

describe("email output", () => {
  it("keeps a link merge tag on the button so it is filled in at send time", () => {
    const html = renderNewsletterBlock(
      block("call-to-action", { buttonText: "Visit", buttonUrl: "{{company.website}}" }),
      null,
      undefined,
    );
    expect(html).toContain('href="{{company.website}}"');
  });

  it("never sends a dangerous link", () => {
    const html = renderNewsletterBlock(
      block("call-to-action", { buttonText: "Visit", buttonUrl: "javascript:alert(1)" }),
      null,
      undefined,
    );
    expect(html.toLowerCase()).not.toContain("javascript:");
  });
});
