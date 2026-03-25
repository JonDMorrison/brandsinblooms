import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { documentationLogoAssets } from "@/pages/integrations/documentation/content/logoAssets";

const zapierSeed = getIntegrationSeed("zapier");

if (!zapierSeed) {
  throw new Error("Zapier integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

const plannedZapExamples = [
  "Trigger: New customer in BloomSuite",
  "Action:  Create row in Google Sheets",
  "",
  "Trigger: Purchase completed in BloomSuite",
  "Action:  Add card to Trello",
  "",
  "Trigger: Form submitted on BloomSuite site",
  "Action:  Send message in Slack",
].join("\n");

export const zapierDocumentation: DocContent = {
  integrationName: zapierSeed.name,
  integrationSlug: zapierSeed.slug,
  category: zapierSeed.categoryLabel,
  pageTitle: "Zapier Integration Guide (In Progress)",
  overview:
    "Connect BloomSuite to 5,000+ apps via Zapier. BloomSuite's Zapier integration is intended to let you trigger Zapier workflows from BloomSuite CRM events and send actions back into BloomSuite without writing code.",
  readingTimeMinutes: 7,
  lastUpdated: "2026-01-15",
  branding: {
    icon: zapierSeed.icon,
    logoSrc: documentationLogoAssets.zapier,
    logoAlt: "Zapier logo",
  },
  sections: [
    {
      id: "what-this-integration-will-do",
      title: "What This Integration Will Do",
      group: "Overview",
      content: (
        <div className={proseClassName}>
          <p>
            Zapier is currently in progress rather than fully launched. The goal
            is to make BloomSuite available as a no-code automation source and
            destination for the apps your team already uses.
          </p>
          <DocCallout title="In-progress feature set">
            The sections below describe the planned Zapier feature set. Some
            capabilities may arrive before others.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "feature-overview",
      title: "Feature Overview",
      group: "Planned Capabilities",
      content: (
        <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Zapier triggers from BloomSuite for customers, purchases,
              automation completions, and subscribers
            </li>
            <li>
              Zapier actions into BloomSuite such as creating contacts, adding
              tags, or triggering automations
            </li>
            <li>Multi-step Zap support</li>
            <li>Filter and delay-step support</li>
          </ul>
          <DocCodeBlock
            language="text"
            code={plannedZapExamples}
            ariaLabel="Planned Zapier examples"
          />
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
            <li>A Zapier account</li>
            <li>
              A clear list of the apps and workflows you want BloomSuite to
              connect to
            </li>
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
            Identify the event types you care about most, the external apps that
            should respond, and which workflows need review before an automation
            layer is allowed to operate unattended.
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
              When will the Zapier integration be available?
            </h3>
            <p>
              The integration is in active development. Availability details
              should be taken from the product rollout, not inferred from this
              page alone.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Will BloomSuite have a native Zapier marketplace app?
            </h3>
            <p>That is the planned direction for launch.</p>
          </div>
        </div>
      ),
    },
  ],
};
