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
    expect(app).not.toContain('import("@/pages/PlanPage")');
    expect(app).toContain('path="/publish"');
    expect(app).toContain('path="/social-accounts"');
    expect(app).toContain('path="/plan"');
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

  it("does not query social data from active settings or analytics surfaces", () => {
    const activeSurfaces = [
      "src/components/settings/SettingsHub.tsx",
      "src/components/settings/ConnectionsSettings.tsx",
      "src/components/analytics/MarketingPerformanceSection.tsx",
      "src/components/analytics/DataSourcesSection.tsx",
    ].map(readSource);

    for (const source of activeSurfaces) {
      expect(source).not.toContain('from("social_connections")');
      expect(source).not.toContain("/social-accounts");
    }
  });
});
