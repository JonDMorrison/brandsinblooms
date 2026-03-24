import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

const customWebhooksSeed = getIntegrationSeed("custom-webhooks");

if (!customWebhooksSeed) {
  throw new Error("Custom Webhooks integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

const examplePayload = `{
  "event": "purchase.completed",
  "timestamp": "2026-03-01T14:30:00Z",
  "site_id": "site_xxxxxxxxxxxx",
  "data": {
    "customer_id": "cust_xxxxxxxxxxxx",
    "customer_email": "jane@example.com",
    "order_total": 4250,
    "currency": "GBP",
    "pos_source": "square"
  }
}`;

const plannedEvents = [
  "customer.created",
  "customer.updated",
  "purchase.completed",
  "first_purchase.completed",
  "loyalty.joined",
  "automation.completed",
  "refund.created",
  "subscriber.created",
  "subscriber.unsubscribed",
].join("\n");

export const customWebhooksDocumentation: DocContent = {
  integrationName: customWebhooksSeed.name,
  integrationSlug: customWebhooksSeed.slug,
  category: customWebhooksSeed.categoryLabel,
  pageTitle: "Custom Webhooks Guide (Coming Soon)",
  overview:
    "BloomSuite's Custom Webhooks integration is planned to let you send CRM events to any external system via HTTP webhook. Configure endpoints, authentication headers, and payload templates to connect BloomSuite to tools not covered by native integrations.",
  readingTimeMinutes: 6,
  lastUpdated: "2026-01-15",
  branding: {
    icon: customWebhooksSeed.icon,
  },
  sections: [
    {
      id: "what-this-integration-will-do",
      title: "What This Integration Will Do",
      group: "Overview",
      content: (
        <div className={proseClassName}>
          <p>
            Custom Webhooks is planned as an outbound event-delivery surface for
            BloomSuite. The goal is to let teams push BloomSuite events into
            external systems that do not yet have native integrations.
          </p>
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
              Create multiple webhook endpoints for different BloomSuite event
              types
            </li>
            <li>Configure HTTP method, destination URL, and custom headers</li>
            <li>Use JSON payload templates with event merge fields</li>
            <li>Review delivery logs with status codes and timing</li>
            <li>Automatic retry with backoff and outbound signing</li>
          </ul>
          <DocCodeBlock
            language="json"
            code={examplePayload}
            ariaLabel="Planned webhook payload"
          />
          <DocCodeBlock
            language="text"
            code={plannedEvents}
            ariaLabel="Planned supported event types"
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
            <li>The URL of the external endpoint you control</li>
            <li>The authentication method your endpoint expects</li>
            <li>A clear list of which BloomSuite events should be delivered</li>
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
            Define endpoint ownership, secret management, retry expectations,
            and downstream monitoring before you rely on webhook delivery for a
            production workflow.
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
              Can I create multiple webhooks for different events?
            </h3>
            <p>That per-event endpoint model is part of the planned design.</p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Will there be a test or debug tool?
            </h3>
            <p>
              A webhook test and inspection workflow is planned for the future
              integration.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
