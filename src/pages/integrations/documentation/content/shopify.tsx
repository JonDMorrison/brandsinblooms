import { DocCallout } from "@/components/docs/DocCallout";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { documentationLogoAssets } from "@/pages/integrations/documentation/content/logoAssets";

const shopifySeed = getIntegrationSeed("shopify");

if (!shopifySeed) {
  throw new Error("Shopify integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

export const shopifyDocumentation: DocContent = {
  integrationName: shopifySeed.name,
  integrationSlug: shopifySeed.slug,
  category: shopifySeed.categoryLabel,
  pageTitle: "Shopify Integration Guide",
  overview:
    "BloomSuite's Shopify integration connects your Shopify store to sync customers, orders, and products into BloomSuite CRM, verify webhook coverage, and power payment-driven automation from your Shopify storefront.",
  readingTimeMinutes: 8,
  lastUpdated: "2026-03-29",
  branding: {
    icon: shopifySeed.icon,
    logoSrc: documentationLogoAssets.shopify,
    logoAlt: "Shopify logo",
  },
  sections: [
    {
      id: "what-this-integration-does",
      title: "What This Integration Does",
      group: "Overview",
      content: (
        <div className={proseClassName}>
          <p>
            Shopify is a live BloomSuite integration for stores that want one
            tenant-scoped view of Shopify customers, orders, products, sync
            health, and webhook coverage.
          </p>
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
              Permission to install the BloomSuite app and approve webhook
              access
            </li>
            <li>Admin access if you need to run Shopify diagnostics</li>
          </ul>
        </div>
      ),
    },
    {
      id: "connecting-your-shopify-store",
      title: "Connecting Your Shopify Store",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            Start from the Shopify integration detail page, enter your store
            domain, and complete the BloomSuite app install through Shopify
            OAuth. BloomSuite stores the encrypted Shopify token for the tenant,
            registers the required webhook topics, and immediately exposes sync
            health on the integration detail page.
          </p>
          <DocCallout title="Use the same install flow for reconnects and app reinstalls">
            If the page shows <strong>Reconnect required</strong> or{" "}
            <strong>App uninstalled</strong>, use the same Shopify install flow
            to restore credentials and webhook subscriptions.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "data-dashboard-tabs",
      title: "Data Dashboard Tabs",
      group: "Operations",
      content: (
        <div className="space-y-3 text-[15px] leading-7 text-muted-foreground">
          <p>The Shopify detail page includes four operator tabs:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Customers</strong>: search synced customer records,
              inspect CRM linkage, and review marketing consent and address
              payloads
            </li>
            <li>
              <strong>Orders</strong>: filter paid, pending, and refunded
              orders, inspect line items, and review order totals and customer
              attribution
            </li>
            <li>
              <strong>Products</strong>: search catalog data, filter by product
              type, and inspect variant and image payloads
            </li>
            <li>
              <strong>Sync Logs</strong>: review queue-backed Shopify sync jobs,
              progress state, failures, and retry opportunities
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "webhook-verification-and-recovery",
      title: "Webhook Verification and Recovery",
      group: "Operations",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite expects 11 Shopify webhook topics covering customers,
            orders, refunds, products, and app uninstall events. If Shopify
            shows <strong>Webhooks only</strong>, BloomSuite is connected but
            still needs verified real-time event coverage.
          </p>
          <DocCallout title="Verify Webhooks is the first recovery action">
            Run <strong>Verify Webhooks</strong> from the detail page before
            forcing a reinstall. Reinstall the app only when the page shows a
            missing credential state or Shopify reports that the app was
            removed.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "admin-diagnostics",
      title: "Admin Diagnostics",
      group: "Operations",
      content: (
        <div className={proseClassName}>
          <p>
            Admins can open Shopify Diagnostics to run a live end-to-end check
            against token decryption, Shopify customers/orders/products API
            access, webhook health, sync queue history, and imported BloomSuite
            records.
          </p>
          <DocCallout title="Diagnostics are admin-only">
            The diagnostics page is intended for operators diagnosing connection
            or data health issues. Standard users still have access to the
            Shopify detail page, sync logs, and webhook verification controls.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "automation-contract",
      title: "Automation Contract",
      group: "Capabilities",
      content: (
        <div className={proseClassName}>
          <p>
            Shopify paid orders continue to flow into BloomSuite through the
            existing <span className="font-mono">payment.completed</span>{" "}
            contract. The integration does not introduce a separate
            purchase-named trigger.
          </p>
        </div>
      ),
    },
    {
      id: "after-connecting",
      title: "After Connecting",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            After install, run a manual sync if you need an immediate backfill.
            Recent sync history, webhook coverage, and imported data counts are
            all visible from the Shopify integration detail page.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Use Sync Now to enqueue a queue-backed Shopify full sync</li>
            <li>Use Sync Logs to inspect in-progress or failed jobs</li>
            <li>
              Use Diagnostics when API access or imported counts look wrong
            </li>
          </ul>
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
              What data syncs today?
            </h3>
            <p>
              BloomSuite currently syncs Shopify customers, orders, and products
              into the existing tenant-scoped Shopify tables and CRM surfaces.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              When should I run diagnostics?
            </h3>
            <p>
              Run diagnostics when webhook verification keeps failing, Shopify
              data counts look wrong, or the detail page suggests the stored
              connection is no longer healthy.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              What automation trigger does Shopify use?
            </h3>
            <p>
              Shopify uses the existing payment.completed automation contract.
              The integration does not introduce a separate purchase.completed
              trigger name.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
