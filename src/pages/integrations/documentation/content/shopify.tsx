import { DocCallout } from "@/components/docs/DocCallout";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

const shopifySeed = getIntegrationSeed("shopify");

if (!shopifySeed) {
  throw new Error("Shopify integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

export const shopifyDocumentation: DocContent = {
  integrationName: shopifySeed.name,
  integrationSlug: shopifySeed.slug,
  category: shopifySeed.categoryLabel,
  pageTitle: "Shopify Integration Guide (Coming Soon)",
  overview:
    "BloomSuite's Shopify integration will connect your Shopify store to bring products, orders, and customer data into your CRM, enabling purchase-triggered automations, inventory-aware marketing, and unified customer profiles across your online and physical retail.",
  readingTimeMinutes: 6,
  lastUpdated: "2026-01-15",
  branding: {
    icon: shopifySeed.icon,
  },
  sections: [
    {
      id: "what-this-integration-will-do",
      title: "What This Integration Will Do",
      group: "Overview",
      content: (
        <div className={proseClassName}>
          <p>
            Shopify is planned as a future ecommerce integration for BloomSuite.
            The goal is to bring store, customer, and order data into one CRM
            view so marketing and storefront workflows can stay coordinated.
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
          <p>Planned capabilities include:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Sync Shopify customers, orders, and products into BloomSuite CRM
            </li>
            <li>
              Trigger automations for new orders, abandoned carts, and
              fulfillment events
            </li>
            <li>Import existing Shopify customers into BloomSuite</li>
            <li>Display Shopify products on BloomSuite-powered pages</li>
            <li>Track Shopify revenue in BloomSuite marketing attribution</li>
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
              Your Shopify store URL such as{" "}
              <span className="font-mono">yourstore.myshopify.com</span>
            </li>
            <li>A Shopify store owner or admin account</li>
            <li>
              A decision on whether BloomSuite will supplement or replace parts
              of your current storefront workflow
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
            Decide which data should move first, who owns the store connection,
            and whether you expect BloomSuite to supplement Shopify or help you
            migrate away from parts of it.
          </p>
          <DocCallout title="Migration path is planned">
            If you currently use Shopify and plan to switch into BloomSuite's
            built-in store features, the Shopify integration is intended to
            support migration of customer and order history when it launches.
          </DocCallout>
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
              Will Shopify inventory sync with BloomSuite's website builder?
            </h3>
            <p>
              That inventory sync is planned as part of the future Shopify
              rollout.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Can I run Shopify and BloomSuite storefront workflows at the same
              time?
            </h3>
            <p>
              Parallel use during migration is the intended direction, but exact
              two-way workflow rules will be documented when the integration is
              available.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
