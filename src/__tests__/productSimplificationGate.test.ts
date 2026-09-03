import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getIntegrationSeeds } from "@/components/integrations/integrationsHubConfig";

const root = resolve(process.cwd());
const readSource = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("BloomSuite product simplification release gate", () => {
  it("keeps legacy social routes redirected and out of application bundles", () => {
    const app = readSource("src/App.tsx");

    expect(app).not.toContain('import("@/pages/PublishPage")');
    expect(app).not.toContain('import("@/pages/SocialMediaPage")');
    expect(app).not.toContain('import("@/pages/CarouselComposerPage")');
    expect(app).not.toContain('import("@/pages/integrations/SocialIntegrationsPage")');
    expect(app).not.toContain('import("@/pages/AuthCallbackPage")');
    expect(app).not.toContain('import("@/pages/PlanPage")');
    expect(app).not.toContain('import("@/pages/ContentLibraryPage")');
    expect(app).toContain('path="/publish"');
    expect(app).toContain('path="/social-accounts"');
    expect(app).toContain('path="/plan"');
    expect(app).toContain('path="/content/library"');
  });

  it("offers only CRM, email, SMS, POS, analytics, and automation navigation", () => {
    const navigation = readSource("src/components/navigation/sidebarNavigation.ts");
    const userMenu = readSource("src/components/UserMenu.tsx");

    expect(navigation).not.toContain("legacySocialItem");
    expect(navigation).not.toContain("Publish Portal");
    expect(userMenu).not.toContain("Social Media");
    expect(userMenu).not.toContain("Publish Portal");
  });

  it("does not expose social providers in the integrations catalog", () => {
    const seeds = getIntegrationSeeds();

    expect(seeds.some((seed) => seed.slug === "meta")).toBe(false);
    expect(seeds.some((seed) => seed.category === ("social" as never))).toBe(false);
  });

  it("does not advertise retired or unapproved providers on public feature pages", () => {
    const campaigns = readSource(
      "src/components/feature-pages/content/campaignsContent.ts",
    );
    const platform = readSource(
      "src/components/feature-pages/content/unifiedPlatformContent.ts",
    );

    expect(campaigns).not.toContain('{ name: "Meta" }');
    expect(platform).not.toContain("social scheduler");
    expect(platform).not.toContain("Constant Contact, Meta");
    expect(platform).not.toContain("Shopify, Clover");
  });

  it("does not query social data from active settings or analytics surfaces", () => {
    const activeSurfaces = [
      "src/pages/BloomSuiteDashboard.tsx",
      "src/pages/CalendarPage.tsx",
      "src/components/CalendarViewNext.tsx",
      "src/components/calendar/QuickAddSheet.tsx",
      "src/components/calendar/CalendarCampaignCreateDialog.tsx",
      "src/components/calendar/CampaignDetailsModal.tsx",
      "src/components/calendar/ThemeDisplay.tsx",
      "src/pages/OnboardingPage.tsx",
      "src/components/onboarding/CompanyProfileCreator.ts",
      "src/components/onboarding/OnboardingCompletion.ts",
      "src/components/settings/SettingsHub.tsx",
      "src/components/settings/ConnectionsSettings.tsx",
      "src/components/analytics/MarketingPerformanceSection.tsx",
      "src/components/analytics/DataSourcesSection.tsx",
      "src/hooks/useIntegrationsHubData.ts",
    ].map(readSource);

    for (const source of activeSurfaces) {
      expect(source).not.toContain('from("social_connections")');
      expect(source).not.toContain("/social-accounts");
      expect(source).not.toContain('post_type: "instagram"');
      expect(source).not.toContain('post_type: "facebook"');
      expect(source).not.toContain("generateRequiredTasks");
      expect(source).not.toContain("CampaignContentSection");
    }
  });

  it("keeps retired provider workers inert", () => {
    const retiredFunctions = [
      "connect-facebook",
      "connect-meta",
      "exchange-oauth-code",
      "generate-social-content",
      "generate_campaign_content",
      "post-to-facebook",
      "post-to-instagram",
      "publish-delete",
      "publish-now",
      "publish-reschedule",
      "publish-schedule",
      "publish-task",
      "schedule-optimal-posts",
      "upload-social-icons",
    ];

    for (const functionName of retiredFunctions) {
      const source = readSource(`supabase/functions/${functionName}/index.ts`);
      expect(source).toContain("retiredSocialFeatureResponse");
      expect(source).not.toContain("graph.facebook.com");
    }
  });

  it("archives social data and blocks new social tasks", () => {
    const migration = readSource(
      "supabase/migrations/20260903213000_retire_social_media_management.sql",
    );

    expect(migration).toContain("access_token = 'RETIRED'");
    expect(migration).toContain("status = 'ERROR'::public.post_status");
    expect(migration).toContain("reject_retired_social_content_task");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF post_type");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.social_connections FROM anon, authenticated",
    );
  });
});
