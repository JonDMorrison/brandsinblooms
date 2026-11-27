import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import {
  footerWebsiteLabel,
  generateEmailHtml,
  renderFooterBlockToEmailHtml,
  resolveFooterWebsiteUrl,
} from "@/lib/studio/emailHtmlGenerator";
import { ensureFooterBlockCompliance } from "@/lib/studio/footerCompliance";
import type { StudioBlock } from "@/types/studioBlocks";
import { renderContentBlocksToEmailHtml } from "../../../../supabase/functions/_shared/campaignEmailSource";
import { generateServerFooterHtml } from "../../../../supabase/functions/_shared/footerGenerator";

const artsNursery = buildStudioDesignSystem({ name: "Art's Nursery", websiteUrl: "https://www.artsnursery.com/" });
// Northfield Garden Center's live business profile (company_profiles row of
// the tenant admin, read-only 2026-11-27): website_url is null.
const northfield = buildStudioDesignSystem({ name: "Northfield Garden Center", address: "1842 Hawthorne Garden Way, Portland" });
// The footer block saved on Northfield drafts while a master admin built them:
// it carries the admin's own company website.
const staleFooter = {
  ...createStudioBlock("footer"),
  businessName: "Northfield Garden Center",
  websiteUrl: "https://getclear.ca",
  showWebsiteLink: true,
} as StudioBlock;

describe("footer website link", () => {
  it("shows the web address instead of the word Website", () => {
    const footer = createStudioBlock("footer", artsNursery);
    const html = renderFooterBlockToEmailHtml(footer, {}, artsNursery);
    expect(html).toMatch(/<a href="https:\/\/www\.artsnursery\.com\/"[^>]*>www\.artsnursery\.com<\/a>/);
    expect(html).not.toContain(">Website<");
  });

  it("uses the active tenant's profile website, never one saved on the block", () => {
    expect(resolveFooterWebsiteUrl(staleFooter, artsNursery)).toBe("https://www.artsnursery.com/");
    const html = renderFooterBlockToEmailHtml(staleFooter, {}, artsNursery);
    expect(html).toContain("www.artsnursery.com");
    expect(html).not.toContain("getclear");
  });

  it("hides the link when the tenant's profile has no website", () => {
    expect(resolveFooterWebsiteUrl(staleFooter, northfield)).toBe("");
    expect(resolveFooterWebsiteUrl(staleFooter, null)).toBe("");
    for (const html of [
      renderFooterBlockToEmailHtml(staleFooter, {}, northfield),
      renderFooterBlockToEmailHtml(staleFooter, {}, null),
      // Campaign editor preview / saved content HTML.
      generateEmailHtml({ blocks: [staleFooter], subject: "Hi", previewText: "", footer: staleFooter, designSystem: northfield }),
    ]) {
      expect(html).not.toContain("getclear");
      expect(html).not.toContain("#website");
      expect(html).toContain("Unsubscribe");
    }
  });

  it("hides the link when Show Website Link is off", () => {
    const off = { ...staleFooter, showWebsiteLink: false };
    expect(resolveFooterWebsiteUrl(off, artsNursery)).toBe("");
    expect(renderFooterBlockToEmailHtml(off, {}, artsNursery)).not.toContain("artsnursery");
  });

  it("the send path renders the campaign tenant's profile website, not the stored block's", () => {
    const blocks = [{ type: "plain-text", body: "Hello", order: 0 }, { ...staleFooter, order: 1 }];
    const northfieldProfile = { company_name: "Northfield Garden Center", street_address: "1842 Hawthorne Garden Way", city: "Portland", website_url: null };
    const sent = renderContentBlocksToEmailHtml(blocks, { companyProfile: northfieldProfile });
    expect(sent).toContain("Northfield Garden Center");
    expect(sent).not.toContain("getclear");
    const withSite = renderContentBlocksToEmailHtml(blocks, { companyProfile: { ...northfieldProfile, website_url: "https://northfield.example" } });
    expect(withSite).toContain('>northfield.example</a>');
    expect(withSite).not.toContain("getclear");
  });

  it("the legacy server footer shows the profile website and hides it when missing", () => {
    expect(generateServerFooterHtml({ company_name: "Northfield Garden Center" }, "#u")).not.toMatch(/Website<\/a>|#website/);
    expect(generateServerFooterHtml({ company_name: "Art's Nursery", website_url: "https://www.artsnursery.com/" }, "#u"))
      .toContain(">www.artsnursery.com</a>");
  });

  it("draft hydration replaces a stale block website with the tenant's", () => {
    const [hydrated] = ensureFooterBlockCompliance([staleFooter], { designSystem: northfield });
    expect(hydrated.websiteUrl).toBe("");
    expect(hydrated.showWebsiteLink).toBe(true);
    const [withSite] = ensureFooterBlockCompliance([staleFooter], { designSystem: artsNursery });
    expect(withSite.websiteUrl).toBe("https://www.artsnursery.com/");
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
