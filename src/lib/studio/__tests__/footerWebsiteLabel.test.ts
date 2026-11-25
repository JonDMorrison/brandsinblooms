import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { footerWebsiteLabel, renderFooterBlockToEmailHtml } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

describe("footer website link", () => {
  it("shows the web address instead of the word Website", () => {
    const footer = { ...createStudioBlock("footer"), websiteUrl: "https://www.artsnursery.com/", showWebsiteLink: true } as StudioBlock;
    const html = renderFooterBlockToEmailHtml(footer, {}, null);
    expect(html).toMatch(/<a href="https:\/\/www\.artsnursery\.com\/"[^>]*>www\.artsnursery\.com<\/a>/);
    expect(html).not.toContain(">Website<");
  });

  it.each([
    ["https://www.artsnursery.com", "www.artsnursery.com"],
    ["artsnursery.com/shop/", "artsnursery.com/shop"],
    ["", "Website"],
    [undefined, "Website"],
  ])("%s → %s", (url, label) => {
    expect(footerWebsiteLabel(url)).toBe(label);
  });
});
