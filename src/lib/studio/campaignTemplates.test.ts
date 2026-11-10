import {
  buildBotanicalEditorial,
  BOTANICAL_TEMPLATES,
  parseBotanicalBrief,
} from "./botanicalEditorial";
import { generateEmailHtml } from "./emailHtmlGenerator";
import { buildStudioDesignSystem } from "./designSystem";
import { renderContentBlocksToEmailHtml } from "../../../supabase/functions/_shared/campaignEmailSource";
import { describe, expect, it } from "vitest";

import {
  applyCampaignTemplateDesignDefaults,
  CAMPAIGN_TEMPLATES,
} from "@/lib/studio/campaignTemplates";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { DEFAULT_NEWSLETTER_SETTINGS } from "@/lib/studio/newsletter/settings";

describe("campaign template design system", () => {
  it("uses the warm, paced newsletter canvas as the platform default", () => {
    expect(DEFAULT_NEWSLETTER_SETTINGS).toMatchObject({
      width: 640,
      backgroundColor: "#ece8de",
      contentBackgroundColor: "#fbfaf6",
      blockGap: 12,
    });
  });

  it("preserves the existing seasonal templates branded close and rhythm", () => {
    for (const template of CAMPAIGN_TEMPLATES.filter(
      (entry) => !entry.id.startsWith("botanical-"),
    )) {
      const blocks = template.buildBlocks();
      const cta = blocks.find((block) => block.type === "call-to-action");
      const footer = blocks.find((block) => block.type === "footer");

      expect(cta, template.id).toMatchObject({
        backgroundColor: template.accentColor,
        buttonColor: "#fffaf1",
        useBrandButtonColor: false,
        verticalPadding: 36,
      });
      expect(footer?.newsletterSettings, template.id).toMatchObject({
        width: 640,
        backgroundColor: "#ece8de",
        contentBackgroundColor: "#fbfaf6",
        blockGap: 12,
      });
    }
  });

  it("alternates split-layout imagery while preserving image-first mobile markup", () => {
    const blocks = applyCampaignTemplateDesignDefaults([
      createStudioBlock("image-text"),
      createStudioBlock("event"),
      createStudioBlock("image-text"),
    ]);

    expect(blocks[0]).toMatchObject({
      imagePosition: "left",
      layout: "image-left",
      backgroundColor: "#fbfaf6",
    });
    expect(blocks[1]).toMatchObject({
      imagePosition: "right",
      backgroundColor: "#f6f2e8",
    });
    expect(blocks[2]).toMatchObject({
      imagePosition: "left",
      layout: "image-left",
      backgroundColor: "#fbfaf6",
    });
  });

  it("includes a distinct image-led showcase template", () => {
    const template = CAMPAIGN_TEMPLATES.find(
      (candidate) => candidate.id === "evergreen-seasonal-showcase",
    );
    expect(template).toBeDefined();

    const blocks = template!.buildBlocks();
    expect(blocks.filter((block) => block.type === "image-text")).toHaveLength(
      3,
    );
    expect(
      blocks
        .filter((block) => block.type === "image-text")
        .map((block) => block.imagePosition),
    ).toEqual(["left", "right", "left"]);
    expect(template!.formatLabel).toBe("Image-led · 3 stories · Closing CTA");
  });
});

describe("Botanical Editorial reusable newsletter", () => {
  const brief = {
    headline: "Make a wreath. Make a night of it.",
    introduction: "Join us for a creative evening.",
    heroImageUrl: "https://example.com/wreath.jpg",
    heroImageAlt: "A fresh evergreen wreath",
    features: [
      {
        title: "Wreath workshop",
        body: "Wednesday at 7 p.m.",
        buttonText: "Book your place",
        buttonUrl: "https://example.com/workshop",
      },
    ],
    images: [{ url: "https://example.com/ribbon.jpg", alt: "A ribbon wreath" }],
    closing: "See you soon!",
  };
  it("registers four discoverable designs with fresh editable blocks and no client-specific assets", () => {
    for (const entry of BOTANICAL_TEMPLATES) {
      const template = CAMPAIGN_TEMPLATES.find((item) => item.id === entry.id)!;
      const first = template.buildBlocks();
      const second = template.buildBlocks();
      expect(first[1]).toMatchObject({
        type: "email-safe-hero",
        heroStyle: "image-overlay",
        layout: "editorial-panel",
        imageUrl: "",
      });
      expect(first.map((block) => block.id)).not.toEqual(
        second.map((block) => block.id),
      );
      expect(first.every((block, index) => block.order === index)).toBe(true);
      expect(JSON.stringify(first)).not.toMatch(
        /flowerhouse|Chilliwack|6 seats|123 Main/i,
      );
      expect(
        first.find((block) => block.type === "footer")?.newsletterSettings,
      ).toMatchObject({ blockGap: 0, width: 640 });
    }
  });
  it("renders supplied photos, live text, one action and compliance through the send renderer", () => {
    const blocks = buildBotanicalEditorial("botanical-editorial", null, brief);
    const html = generateEmailHtml({
      blocks,
      subject: "Invitation",
      previewText: "Come create",
      footer: null,
      footerLinks: {
        unsubscribeUrl: "https://example.com/unsubscribe",
        preferencesUrl: "https://example.com/preferences",
      },
    });
    expect(html).toContain('background="https://example.com/wreath.jpg"');
    expect(html).toContain("background-color:#243c32");
    expect(html).toContain("Make a wreath. Make a night of it.");
    expect(html).toContain("https://example.com/ribbon.jpg");
    expect(html.match(/href="https:\/\/example.com\/workshop"/g)).toHaveLength(
      1,
    );
    expect(html).toContain("https://example.com/unsubscribe");
    expect(html).not.toMatch(/6 seats|price|November/);
  });
  it("preserves blocks after JSON storage and uses the same server rendering path", () => {
    const blocks = JSON.parse(
      JSON.stringify(
        buildBotanicalEditorial("botanical-events", null, {
          ...brief,
          features: [
            ...brief.features,
            {
              ...brief.features[0],
              title: "Second workshop",
              buttonUrl: "https://example.com/second",
            },
          ],
        }),
      ),
    );
    const html = renderContentBlocksToEmailHtml(blocks, {
      subject: "Workshops",
    });
    expect(html).toContain("Second workshop");
    expect(html).toContain('background="https://example.com/wreath.jpg"');
    expect(html).toContain("https://example.com/second");
  });
  it("inherits the selected company logo and accent without borrowing another client's media", () => {
    const design = buildStudioDesignSystem({
      name: "My Nursery",
      logoUrl: "https://example.com/logo.png",
      brandPrimaryColor: "#d191ad",
      brandPrimaryColorRaw: "#d191ad",
    });
    const blocks = buildBotanicalEditorial("botanical-product", design, brief);
    expect(blocks[0].logoUrl).toBe("https://example.com/logo.png");
    expect(blocks.find((block) => block.type === "divider")?.lineColor).toBe(
      "#d191ad",
    );
    expect(blocks.find((block) => block.type === "footer")?.businessName).toBe(
      "My Nursery",
    );
  });
  it("keeps the headline readable when a photo is missing and rejects unsafe destinations", () => {
    const blocks = buildBotanicalEditorial("botanical-editorial", null, {
      ...brief,
      heroImageUrl: undefined,
    });
    const html = generateEmailHtml({
      blocks,
      subject: "Invitation",
      previewText: "",
      footer: null,
    });
    expect(html).toContain(brief.headline);
    expect(html).not.toContain('background="https://example.com/wreath.jpg"');
    expect(() =>
      parseBotanicalBrief({ ...brief, heroImageUrl: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      parseBotanicalBrief({
        ...brief,
        features: [{ ...brief.features[0], buttonUrl: "javascript:alert(1)" }],
      }),
    ).toThrow();
    expect(() =>
      parseBotanicalBrief({ headline: "Missing details" }),
    ).toThrow();
  });
});
