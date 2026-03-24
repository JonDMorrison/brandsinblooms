import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

const slackSeed = getIntegrationSeed("slack");

if (!slackSeed) {
  throw new Error("Slack integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

export const slackDocumentation: DocContent = {
  integrationName: slackSeed.name,
  integrationSlug: slackSeed.slug,
  category: slackSeed.categoryLabel,
  pageTitle: "Slack Integration Guide (Coming Soon)",
  overview:
    "Bring BloomSuite CRM notifications, automation alerts, and customer activity summaries into your Slack workspace. Keep your team informed about what is happening in your store without leaving Slack.",
  readingTimeMinutes: 5,
  lastUpdated: "2026-01-15",
  branding: {
    icon: slackSeed.icon,
  },
  sections: [
    {
      id: "what-this-integration-will-do",
      title: "What This Integration Will Do",
      group: "Overview",
      content: (
        <div className={proseClassName}>
          <p>
            Slack is planned as a team-notification and workflow-alert surface
            for BloomSuite. The current page is intentionally forward-looking
            and should not be treated as evidence that channel delivery is live
            today.
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
            <li>Real-time CRM event notifications in Slack channels</li>
            <li>
              Integration health alerts for sync failures, webhook errors, and
              token expiry
            </li>
            <li>
              Daily or weekly performance summaries in a designated channel
            </li>
            <li>Custom alert routing rules based on event type or threshold</li>
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
            <li>
              A Slack workspace where you can install apps or approve
              integrations
            </li>
            <li>
              A plan for which channels should receive which types of
              notifications
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
            Decide which channels should receive sales, support, marketing, or
            infrastructure notifications and which teams should own response and
            escalation when alerts arrive.
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
              Can we get purchase notifications in a dedicated sales channel?
            </h3>
            <p>
              That channel-routing behavior is planned for the future Slack
              integration.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Will Slack direct messages be supported?
            </h3>
            <p>
              Channel notifications are the primary use case today;
              direct-message behavior would be a later extension if supported.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
