import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

const hubspotSeed = getIntegrationSeed("hubspot");

if (!hubspotSeed) {
  throw new Error("HubSpot integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

export const hubspotDocumentation: DocContent = {
  integrationName: hubspotSeed.name,
  integrationSlug: hubspotSeed.slug,
  category: hubspotSeed.categoryLabel,
  pageTitle: "HubSpot Integration Guide (Coming Soon)",
  overview:
    "BloomSuite's HubSpot integration will bridge your BloomSuite CRM with HubSpot, syncing contacts and deals, sharing automation trigger data, and giving your sales team a unified view of customer activity across both platforms.",
  readingTimeMinutes: 5,
  lastUpdated: "2026-01-15",
  branding: {
    icon: hubspotSeed.icon,
  },
  sections: [
    {
      id: "what-this-integration-will-do",
      title: "What This Integration Will Do",
      group: "Overview",
      content: (
        <div className={proseClassName}>
          <p>
            HubSpot is planned as a future CRM and automation handoff
            integration. The intent is to let BloomSuite and HubSpot share
            customer context without forcing teams to work in disconnected
            systems.
          </p>
        </div>
      ),
    },
    {
      id: "feature-overview",
      title: "Feature Overview",
      group: "Planned Capabilities",
      content: (
        <div className="space-y-3 text-[15px] leading-7 text-muted-foreground">
          <ul className="list-disc space-y-2 pl-6">
            <li>Sync BloomSuite CRM contacts into HubSpot contacts</li>
            <li>
              Push BloomSuite automation events into HubSpot as timeline
              activities
            </li>
            <li>Import HubSpot contacts into BloomSuite</li>
            <li>Bi-directional deal and pipeline sync</li>
            <li>Shared customer tags and lifecycle stages</li>
          </ul>
        </div>
      ),
    },
    {
      id: "what-youll-need",
      title: "What You'll Need",
      group: "Prerequisites",
      content: (
        <div className="space-y-3 text-[15px] leading-7 text-muted-foreground">
          <ul className="list-disc space-y-2 pl-6">
            <li>An active HubSpot account</li>
            <li>HubSpot Super Admin or integration-level access</li>
          </ul>
        </div>
      ),
    },
    {
      id: "how-to-prepare-before-launch",
      title: "How to Prepare Before Launch",
      group: "Getting Ready",
      content: (
        <div className={proseClassName}>
          <p>
            Decide which objects and teams should stay authoritative in each
            platform before the launch, especially if you expect HubSpot and
            BloomSuite to share contact and deal ownership.
          </p>
        </div>
      ),
    },
    {
      id: "frequently-asked-questions",
      title: "Frequently Asked Questions",
      group: "FAQ",
      content: (
        <div className="space-y-5 text-[15px] leading-7 text-muted-foreground">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Will this work with HubSpot Free?
            </h3>
            <p>
              API and feature limitations may affect some future sync behaviors.
              Final details will be documented at launch.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Can BloomSuite automations trigger HubSpot workflows?
            </h3>
            <p>
              That bi-directional automation handoff is planned for the future
              integration.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
