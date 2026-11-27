import { describe, expect, it } from "vitest";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { buildStudioDesignSystem } from "@/lib/studio/designSystem";
import {
  createFooterBlockFromProfile,
  generateEmailHtml,
  renderFooterBlockToEmailHtml,
  resolveFooterWebsiteUrl,
} from "@/lib/studio/emailHtmlGenerator";
import { buildCampaignPreviewHtml } from "@/lib/crm/campaignPreviewHtml";
import {
  isPlatformWebsite,
  loadTenantWebsite,
  normalizeTenantWebsite,
  PLATFORM_WEBSITE_DOMAINS,
  profileWithTenantWebsite,
  resolveTenantWebsite,
  withTenantWebsite,
  type TenantWebsiteClient,
} from "@/lib/studio/tenantWebsite";
import type { StudioBlock } from "@/types/studioBlocks";
import { renderContentBlocksToEmailHtml } from "../../../../supabase/functions/_shared/campaignEmailSource";
import { generateServerFooterHtml } from "../../../../supabase/functions/_shared/footerGenerator";
import { resolveDesignSystem } from "../../../../supabase/functions/_shared/resolveDesignSystem";
import {
  createMergeTagDataFromCustomer,
  renderMergeTags,
} from "../../../../supabase/functions/_shared/mergeTagEngine";

const PLATFORM_HOSTS = [
  "getclear.ca",
  "brandsinblooms.com",
  "bloomsuite.app",
  "bloomsuite.com",
  "bloomsites.app",
];

function expectNoPlatformDomain(html: string) {
  for (const host of PLATFORM_HOSTS) {
    expect(html.toLowerCase()).not.toContain(host);
  }
}

// A footer block saved on a draft built by a master admin: it carries the
// admin's own company website and business name (live Northfield drafts).
const staleFooter = {
  ...createStudioBlock("footer"),
  businessName: "Northfield Garden Center",
  address: "1842 Hawthorne Garden Way\nPortland, OR 97201",
  websiteUrl: "https://getclear.ca",
  showWebsiteLink: true,
} as StudioBlock;
const blocks = [
  { type: "plain-text", body: "Hello from the garden", order: 0 },
  { ...staleFooter, order: 1 },
];

/** A fake Supabase client serving fixed rows per table. */
function fakeClient(tables: Record<string, unknown>): TenantWebsiteClient {
  return {
    from: (table: string) => ({
      select: () => {
        const result = { data: tables[table] ?? null, error: null };
        const builder = {
          eq: () => builder,
          order: () => builder,
          maybeSingle: () => Promise.resolve(result),
          then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        };
        return builder;
      },
    }),
  };
}

describe("resolveTenantWebsite", () => {
  const all = {
    tenant: { settings: { website_url: "https://settings.example" }, website: "https://column.example" },
    profile: {
      website_url: "https://profile.example",
      feature_flags: { footer_settings: { websiteUrl: "https://footer.example" } },
    },
    site: {
      domains: [{ domain: "custom.example", type: "custom", status: "active", verified_at: "2026-11-01T00:00:00Z" }],
      connectedSiteOrigins: ["https://northfieldgardens.ca"],
    },
  };

  it("takes the first non-empty source in order", () => {
    expect(resolveTenantWebsite(all)).toBe("https://settings.example");
    expect(resolveTenantWebsite({ ...all, tenant: { ...all.tenant, settings: {} } })).toBe("https://column.example");
    expect(resolveTenantWebsite({ ...all, tenant: null })).toBe("https://profile.example");
    expect(resolveTenantWebsite({ ...all, tenant: null, profile: { ...all.profile, website_url: " " } }))
      .toBe("https://footer.example");
    expect(resolveTenantWebsite({ site: all.site })).toBe("https://custom.example");
    expect(resolveTenantWebsite({ site: { connectedSiteOrigins: all.site.connectedSiteOrigins } }))
      .toBe("https://northfieldgardens.ca");
  });

  it("reads every tenant settings website key", () => {
    for (const key of ["website", "website_url", "websiteUrl", "company_website", "companyWebsite"]) {
      expect(resolveTenantWebsite({ tenant: { settings: { [key]: "garden.example" } } })).toBe("https://garden.example");
    }
  });

  it("prefers a verified custom domain over the bloomsites.app address", () => {
    expect(resolveTenantWebsite({
      site: {
        domains: [
          { domain: "pending.example", type: "custom", status: "pending", verified_at: null },
          { domain: "Verified.Example", type: "custom", status: "active", verified_at: "2026-11-02T00:00:00Z" },
        ],
        connectedSiteOrigins: ["https://northfield.bloomsites.app"],
      },
    })).toBe("https://verified.example");
    expect(resolveTenantWebsite({
      site: {
        domains: [{ domain: "pending.example", type: "custom", status: "pending", verified_at: null }],
        connectedSiteOrigins: ["https://northfield.bloomsites.app"],
      },
    })).toBe("https://northfield.bloomsites.app");
  });

  it("skips platform domains at every step and never invents one", () => {
    expect(resolveTenantWebsite({
      tenant: { settings: { website: "https://www.getclear.ca/" }, website: "brandsinblooms.com" },
      profile: { website_url: "https://getclear.ca", feature_flags: { footer_settings: { websiteUrl: "https://app.bloomsuite.app" } } },
      site: { connectedSiteOrigins: ["https://bloomsites.app", "https://northfieldgardens.ca"] },
    })).toBe("https://northfieldgardens.ca");
    expect(resolveTenantWebsite({ profile: { website_url: "getclear.ca" } })).toBe("");
    expect(resolveTenantWebsite({})).toBe("");
  });

  it("classifies platform and tenant hosts", () => {
    for (const domain of PLATFORM_WEBSITE_DOMAINS) {
      expect(isPlatformWebsite(`https://${domain}`)).toBe(true);
      expect(isPlatformWebsite(`https://www.${domain}/about`)).toBe(true);
    }
    expect(isPlatformWebsite("https://www.bloomsites.app")).toBe(true);
    expect(isPlatformWebsite("https://horsford-gardens.bloomsites.app")).toBe(false);
    expect(isPlatformWebsite("https://notgetclear.ca")).toBe(false);
    expect(normalizeTenantWebsite("northfieldgardens.ca")).toBe("https://northfieldgardens.ca");
    expect(normalizeTenantWebsite("https://www.artsnursery.com/")).toBe("https://www.artsnursery.com/");
    expect(normalizeTenantWebsite("javascript:alert(1)")).toBe("");
    expect(normalizeTenantWebsite("localhost")).toBe("");
  });

  it("loads tenant, BloomSites and profile facts with the shared loader", async () => {
    const client = fakeClient({
      tenants: { website: null, settings: { is_demo: true } },
      domains: [],
      crm_connected_websites: [{ site_origin: "https://northfieldgardens.ca", linked_at: "2026-11-20T00:00:00Z" }],
    });
    expect(await loadTenantWebsite(client, "tenant-1", { website_url: "https://getclear.ca" }))
      .toBe("https://northfieldgardens.ca");
    expect(await loadTenantWebsite(fakeClient({}), "tenant-1", null)).toBe("");
    expect(await loadTenantWebsite(client, null, { website_url: "https://own.example" })).toBe("https://own.example");
    expect(await profileWithTenantWebsite(fakeClient({}), "tenant-1", null)).toBeNull();
    expect(await profileWithTenantWebsite(client, "tenant-1", null)).toEqual({ website_url: "https://northfieldgardens.ca" });
  });

  it("withTenantWebsite replaces the stored website", () => {
    expect(withTenantWebsite({ company_name: "A", website_url: "https://getclear.ca" }, ""))
      .toEqual({ company_name: "A", website_url: null });
    expect(withTenantWebsite(null, "")).toBeNull();
  });
});

describe("footer website in every renderer", () => {
  const profileRow = {
    company_name: "Northfield Garden Center",
    street_address: "1842 Hawthorne Garden Way",
    city: "Portland",
    state_province: "OR",
    postal_code: "97201",
    website_url: null,
  };
  const withSite = {
    tenant: null,
    profile: profileRow,
    site: { connectedSiteOrigins: ["https://northfieldgardens.ca"] },
  };

  // Browser: useCompanyInfo puts resolveTenantWebsite's result on companyInfo.
  const browserDesignSystem = (sources: Parameters<typeof resolveTenantWebsite>[0]) =>
    buildStudioDesignSystem({
      name: profileRow.company_name,
      address: "1842 Hawthorne Garden Way, Portland, OR, 97201",
      websiteUrl: resolveTenantWebsite(sources),
    });
  // Server: send/test/preview functions pass withTenantWebsite(profile).
  const serverProfile = (sources: Parameters<typeof resolveTenantWebsite>[0]) =>
    withTenantWebsite(profileRow, resolveTenantWebsite(sources));

  it("a tenant with a website links to it in the canvas, editor preview and send", () => {
    const design = browserDesignSystem(withSite);
    expect(resolveFooterWebsiteUrl(staleFooter, design)).toBe("https://northfieldgardens.ca");
    const outputs = [
      renderFooterBlockToEmailHtml(staleFooter, {}, design),
      buildCampaignPreviewHtml({ blocks: [staleFooter], subjectLine: "Hi", previewText: "", designSystem: design }),
      renderContentBlocksToEmailHtml(blocks, { companyProfile: serverProfile(withSite) }),
      generateServerFooterHtml({ ...profileRow, website_url: serverProfile(withSite)?.website_url }, "#u"),
    ];
    for (const html of outputs) {
      expect(html).toMatch(/href="https:\/\/northfieldgardens\.ca\/?"/);
      expect(html).toContain(">northfieldgardens.ca</a>");
      expectNoPlatformDomain(html);
    }
  });

  it("a tenant without a website renders no website link anywhere", () => {
    const none = { profile: profileRow };
    const design = browserDesignSystem(none);
    expect(resolveFooterWebsiteUrl(staleFooter, design)).toBe("");
    const outputs = [
      renderFooterBlockToEmailHtml(staleFooter, {}, design),
      buildCampaignPreviewHtml({ blocks: [staleFooter], subjectLine: "Hi", previewText: "", designSystem: design }),
      renderContentBlocksToEmailHtml(blocks, { companyProfile: serverProfile(none) }),
      renderContentBlocksToEmailHtml(blocks, { companyProfile: null }),
      generateServerFooterHtml(profileRow, "#u"),
    ];
    for (const html of outputs) {
      expect(html).toContain("Unsubscribe");
      expect(html).not.toMatch(/>Website<\/a>|#website/);
      expect(html).not.toContain("northfieldgardens");
      expectNoPlatformDomain(html);
    }
  });

  it("the browser and server paths render the same footer", () => {
    for (const sources of [withSite, { profile: profileRow }]) {
      const browser = browserDesignSystem(sources);
      const server = resolveDesignSystem(serverProfile(sources));
      expect(server?.company.websiteUrl).toBe(browser.company.websiteUrl);
      expect(renderFooterBlockToEmailHtml(staleFooter, {}, server))
        .toBe(renderFooterBlockToEmailHtml(staleFooter, {}, browser));
    }
  });

  it("never renders a platform website, even when a profile stores one", () => {
    // The master admin's own profile: the row a test send used to load.
    const adminProfile = { ...profileRow, company_name: "Jon Morrison Inc.", website_url: "https://getclear.ca" };
    const design = resolveDesignSystem(adminProfile);
    expect(design?.company.websiteUrl).toBe("");
    const outputs = [
      renderContentBlocksToEmailHtml(blocks, { companyProfile: adminProfile }),
      renderFooterBlockToEmailHtml(createFooterBlockFromProfile(adminProfile), {}, design),
      generateServerFooterHtml(adminProfile, "#u"),
      generateEmailHtml({
        blocks: [staleFooter],
        subject: "Hi",
        previewText: "",
        footer: staleFooter,
        designSystem: buildStudioDesignSystem({ name: "X", websiteUrl: "https://www.brandsinblooms.com" }),
      }),
      renderMergeTags(
        "<a href=\"{{company.website}}\">site</a>",
        createMergeTagDataFromCustomer({ first_name: "Mira" }, { website_url: "https://getclear.ca" }),
      ),
    ];
    for (const html of outputs) expectNoPlatformDomain(html);
    expect(createFooterBlockFromProfile(adminProfile).websiteUrl).toBe("");
  });
});
