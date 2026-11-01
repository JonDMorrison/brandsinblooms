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

  it("gives every built-in template a strong branded close and shared rhythm", () => {
    for (const template of CAMPAIGN_TEMPLATES) {
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
});
