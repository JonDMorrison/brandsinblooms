import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { documentationLogoAssets } from "@/pages/integrations/documentation/content/logoAssets";

const lightspeedSeed = getIntegrationSeed("lightspeed");

if (!lightspeedSeed) {
  throw new Error("Lightspeed integration seed is missing.");
}

const proseClassName = "space-y-4 text-[15px] leading-7 text-muted-foreground";

function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-white">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/70 bg-slate-50/80">
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-border/60 align-top last:border-b-0"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-3 text-sm leading-6 text-muted-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepList({
  steps,
}: {
  steps: Array<{ title: string; body: ReactNode }>;
}) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <DocStep
          key={step.title}
          stepNumber={index + 1}
          stepTitle={step.title}
          isLast={index === steps.length - 1}
        >
          {step.body}
        </DocStep>
      ))}
    </div>
  );
}

const lightspeedWebhookEvents = [
  "sale.completed",
  "sale.updated",
  "customer.created",
  "customer.updated",
  "product.updated",
  "loyalty.updated",
].join("\n");

const webhookModeMatrix: ReactNode[][] = [
  [
    "Real-time",
    "Webhook is registered, verified, and confirmed as enabled in the Lightspeed account.",
    "Normal operating mode. Sales, customer, and product events are delivered in real time.",
  ],
  [
    "Sync only",
    "The connection is active but webhook registration has not been verified yet, or the last verification attempt encountered a transient error.",
    "Use the 'Verify webhooks' action to retry registration. Background sync paths remain available.",
  ],
  [
    "Unavailable",
    "Both X-Series and R-Series webhook endpoint formats returned errors during registration. This should not normally occur on any Lightspeed POS plan.",
    "Contact support if this state persists after retrying. BloomSuite continues to operate via background sync while webhook delivery is unavailable.",
  ],
];

export const lightspeedDocumentation: DocContent = {
  integrationName: lightspeedSeed.name,
  integrationSlug: lightspeedSeed.slug,
  category: lightspeedSeed.categoryLabel,
  pageTitle: "Lightspeed X-Series Integration Guide",
  overview:
    "Connect Lightspeed X-Series to BloomSuite to sync retail customers, sales, products, and real-time webhook events from a store-specific domain. BloomSuite registers webhooks automatically during OAuth and uses background sync jobs to complement real-time delivery with bulk imports, inventory coverage, and recovery paths.",
  readingTimeMinutes: 14,
  lastUpdated: "Apr 29, 2026",
  branding: {
    icon: lightspeedSeed.icon,
    logoSrc: documentationLogoAssets.lightspeed,
    logoAlt: "Lightspeed X-Series logo",
  },
  sections: [
    {
      id: "overview",
      title: "Overview",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            Lightspeed X-Series in BloomSuite is built around a store-specific
            domain prefix, a short-lived OAuth state token, a callback that
            exchanges authorization codes directly against the connected store,
            and a hybrid real-time plus sync model for retail data.
          </p>
          <p>
            Webhooks are available on all Lightspeed POS plans and BloomSuite
            registers them automatically during the OAuth connection flow. When
            webhook registration succeeds, the integration operates in real-time
            mode — sales, customer, and product events are delivered to
            BloomSuite within seconds. Background sync jobs complement real-time
            delivery by handling bulk imports, metric rollups, and inventory
            data that webhooks do not cover.
          </p>
          <DocCallout title="Webhooks vs Business Rules">
            Lightspeed exposes two separate features that both involve
            event-driven behavior. <strong>Webhooks</strong> are available on
            all POS plans and are what BloomSuite uses for real-time event
            delivery. <strong>Business Rules</strong> are a separate
            Plus-plan-only automation feature within Lightspeed and are not used
            by BloomSuite. If Lightspeed support references Business Rules, they
            are referring to a different capability than the webhooks BloomSuite
            subscribes to.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "prerequisites",
      title: "Prerequisites",
      group: "Getting Started",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Valid Lightspeed X-Series store domain prefix",
                body: (
                  <p>
                    BloomSuite starts the OAuth flow with a validated store
                    domain prefix such as the
                    <DocInlineCode>bloom-store</DocInlineCode> part of
                    <DocInlineCode>
                      bloom-store.retail.lightspeed.app
                    </DocInlineCode>
                    .
                  </p>
                ),
              },
              {
                title: "Operator authority for the target store",
                body: (
                  <p>
                    The operator must be able to authorize BloomSuite access in
                    the target Lightspeed account for the correct store context.
                  </p>
                ),
              },
              {
                title: "BloomSuite access to the integration detail page",
                body: (
                  <p>
                    After connecting, use the detail page to verify store URL,
                    retailer name, webhook mode, sync timestamps, and the
                    actions currently exposed for manual sync and diagnostics.
                  </p>
                ),
              },
              {
                title: "Expectation setting for webhook support",
                body: (
                  <p>
                    Lightspeed webhooks are available on all POS plans.
                    BloomSuite registers webhooks automatically during the OAuth
                    connection flow and displays the current delivery status on
                    the integration detail page. If webhook registration fails
                    due to a transient API error, use the "Verify webhooks"
                    action to retry.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "connecting-your-lightspeed-store",
      title: "Connecting Your Lightspeed Store",
      group: "Getting Started",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Enter the store domain prefix",
                body: (
                  <p>
                    BloomSuite validates the domain prefix before creating the
                    OAuth state record. Invalid prefixes are rejected before the
                    authorization URL is generated.
                  </p>
                ),
              },
              {
                title: "Launch the OAuth flow",
                body: (
                  <p>
                    The Lightspeed OAuth start function stores a state token in
                    <DocInlineCode>oauth_states</DocInlineCode>, creates a
                    pending store connection, and sends the operator to
                    <DocInlineCode>
                      secure.retail.lightspeed.app/connect
                    </DocInlineCode>
                    with the correct callback URL.
                  </p>
                ),
              },
              {
                title: "Complete authorization and callback",
                body: (
                  <p>
                    The callback validates the state token, infers the best
                    callback redirect URI when needed, and exchanges the code
                    directly against the store-specific token endpoint at
                    <DocInlineCode>
                      https://&lt;domain-prefix&gt;.retail.lightspeed.app/api/1.0/token
                    </DocInlineCode>
                    .
                  </p>
                ),
              },
              {
                title: "Confirm retailer details in BloomSuite",
                body: (
                  <p>
                    After the callback, BloomSuite stores the retailer name,
                    domain prefix, tokens, and connection state. Webhook
                    registration runs automatically — check the Webhook Mode
                    indicator on the detail page to confirm it shows Real-time.
                    If it shows Sync only, use the "Verify webhooks" action to
                    retry.
                  </p>
                ),
              },
            ]}
          />
          <DocCallout
            variant="success"
            title="Webhook setup runs automatically after connect"
          >
            The callback runs webhook provisioning immediately after saving the
            store connection, so you do not need a separate post-connect webhook
            step.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "webhook-modes-and-verification",
      title: "Webhook Modes and Verification",
      group: "Configuration",
      content: (
        <div className="space-y-4">
          <p className="text-[15px] leading-7 text-muted-foreground">
            Lightspeed webhook registration runs automatically during the OAuth
            connection flow. BloomSuite creates or reuses a webhook subscription
            pointing at the shared webhook handler endpoint, verifies that the
            subscription is active, and persists the resulting mode on the
            connection record. The integration detail page reflects the stored
            webhook mode in real time.
          </p>
          <DocTable
            headers={["Webhook Mode", "Meaning", "How to Operate"]}
            rows={webhookModeMatrix}
          />
          <DocCallout title="Webhooks are available on all Lightspeed POS plans">
            Per Lightspeed support, webhooks are universally available and are
            not gated by subscription tier. If BloomSuite shows "Sync only" or
            "Unavailable," use the "Verify webhooks" action in the detail page
            to retry registration. The most common cause of a failed
            registration is a transient API error during the initial OAuth
            callback.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "sync-settings",
      title: "Sync Settings",
      group: "Configuration",
      content: (
        <div className={proseClassName}>
          <p>
            Lightspeed exposes dedicated sync functions for customers, sales,
            and products. The detail page shows the last sync timestamps and
            current synced counts for those domains, plus a
            <DocInlineCode>Sync Now</DocInlineCode> action when the connection
            is active.
          </p>
          <p>
            When webhooks are operating in real-time mode, background sync jobs
            complement webhook delivery by handling bulk imports, historical
            backfills, and metric aggregation that webhooks do not cover (such
            as inventory counts from the separate inventory endpoint). When the
            integration is in sync-only mode, these same background jobs are the
            primary data pipeline.
          </p>
          <p>
            Customer sync paginates through customer records and links them into
            BloomSuite CRM contacts. Sales sync pulls recent completed sales and
            derives purchase metrics such as first purchase date, total spend,
            and purchase count. Product sync fetches catalog items with pricing,
            and inventory counts are fetched from the separate{" "}
            <DocInlineCode>/api/2.0/inventory</DocInlineCode>
            endpoint.
          </p>
        </div>
      ),
    },
    {
      id: "sales-and-customer-data",
      title: "Sales and Customer Data",
      group: "Data & Sync",
      content: (
        <div className="space-y-4">
          <DocTable
            headers={["Data Type", "Current Behavior", "Destination"]}
            rows={[
              [
                "Customers",
                "Imported through a paginated customer sync and upserted into Lightspeed customer storage, with CRM contact linking when email or phone is present.",
                <>
                  <DocInlineCode>lightspeed_customers</DocInlineCode> and linked{" "}
                  <DocInlineCode>crm_customers</DocInlineCode>
                </>,
              ],
              [
                "Sales",
                "Imported from recent completed sales and enriched with sale lines, payment method, linked contact, and purchase metrics.",
                <>
                  <DocInlineCode>lightspeed_sales</DocInlineCode>
                </>,
              ],
              [
                "Products",
                "Updated through both product sync and product webhook handling.",
                <>
                  <DocInlineCode>lightspeed_products</DocInlineCode>
                </>,
              ],
              [
                "Loyalty balance",
                "Updated when loyalty events are received and the corresponding Lightspeed customer already exists in the tenant.",
                <>
                  <DocInlineCode>
                    lightspeed_customers.loyalty_balance
                  </DocInlineCode>
                </>,
              ],
            ]}
          />
        </div>
      ),
    },
    {
      id: "webhook-event-coverage",
      title: "Webhook Event Coverage",
      group: "Data & Sync",
      content: (
        <div className="space-y-4">
          <p className="text-[15px] leading-7 text-muted-foreground">
            The real-time handler covers fewer domains than the full sync
            surface because inventory and historical backfills still come from
            background jobs, but the events it does receive now trigger full CRM
            propagation and sales rollup processing.
          </p>
          <DocCodeBlock
            language="text"
            code={lightspeedWebhookEvents}
            ariaLabel="Lightspeed webhook event coverage"
          />
          <DocCallout
            variant="info"
            title="Real-time events carry full processing weight"
          >
            When webhooks are active, incoming sale, customer, and product
            events trigger full processing in the webhook handler — including
            CRM customer upserts, sales rollup recalculation, lifetime value
            propagation, and catalog product updates. Background sync jobs
            complement real-time delivery by handling bulk historical imports,
            inventory counts, and metric aggregation.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "automation-and-first-purchase-behavior",
      title: "Automation and First-Purchase Behavior",
      group: "Automations",
      content: (
        <div className={proseClassName}>
          <p>
            Lightspeed sales sync and the real-time webhook handler both update
            purchase count, total spend, first purchase date, and last purchase
            date for matched Lightspeed customers. When a webhook sale event is
            received, the handler recalculates these metrics from the full set
            of completed sales and propagates the rollup to the linked CRM
            customer record.
          </p>
          <p>
            The webhook handler processes sale, customer, and product events
            with full CRM propagation — not just lightweight record updates.
            This means real-time mode provides near-immediate visibility into
            customer lifetime value changes, new customer creation, and product
            catalog updates.
          </p>
          <p>
            For heavier real-time marketing automation (e.g., triggered email
            workflows based on purchase events), validate the exact automation
            trigger wiring in the current app. The Lightspeed webhook handler
            focuses on data integrity and CRM propagation rather than direct
            automation dispatch, unlike the Square webhook handler which
            includes full automation trigger support.
          </p>
        </div>
      ),
    },
    {
      id: "diagnostics-and-operations",
      title: "Diagnostics and Operations",
      group: "Automations",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Check Webhook Mode on the detail page",
                body: (
                  <p>
                    The integration detail page shows the current webhook mode
                    as Real-time, Sync only, or Unavailable. If the mode is not
                    Real-time, use the "Verify webhooks" action before
                    investigating further.
                  </p>
                ),
              },
              {
                title: "Use Verify webhooks to retry registration",
                body: (
                  <p>
                    The "Verify webhooks" action in the detail page actions
                    dropdown re-runs the webhook registration flow against the
                    connected Lightspeed store. This is the first action to take
                    when webhook mode shows Sync only or Unavailable.
                  </p>
                ),
              },
              {
                title: "Use Run diagnostics for deeper investigation",
                body: (
                  <p>
                    The Lightspeed detail page exposes
                    <DocInlineCode>Run diagnostics</DocInlineCode> as the
                    operator action for verifying token health, API endpoint
                    reachability, webhook endpoint format detection, sync queue
                    state, and imported data integrity.
                  </p>
                ),
              },
              {
                title: "Trigger manual sync when data is stale",
                body: (
                  <p>
                    If the store is connected and webhook mode is Real-time but
                    current data looks stale, use
                    <DocInlineCode>Sync Now</DocInlineCode> to trigger a
                    background sync before escalating. Webhooks deliver
                    incremental updates, but a manual sync can backfill any
                    gaps.
                  </p>
                ),
              },
              {
                title: "Review store and activity references already in the UI",
                body: (
                  <p>
                    The Store URL, sync logs, webhook mode, and diagnostics
                    destination are all accessible from the Lightspeed detail
                    page. Use these existing surfaces before changing
                    configuration assumptions or contacting Lightspeed support.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "common-connection-issues",
      title: "Common Connection Issues",
      group: "Troubleshooting",
      content: (
        <DocTable
          headers={["Issue", "Likely Cause", "Resolution"]}
          rows={[
            [
              "OAuth fails after redirect",
              "The domain prefix is wrong, the callback URI is mismatched, or the state token has expired.",
              "Restart the connect flow from BloomSuite and confirm the exact store prefix before retrying.",
            ],
            [
              "Webhook mode shows Sync only after connecting",
              "The initial webhook registration during OAuth callback encountered a transient API error or the webhook endpoint format probe did not succeed on the first attempt.",
              "Use the 'Verify webhooks' action in the detail page to retry. If the issue persists after two retries, run diagnostics and check the webhook endpoint format detection result.",
            ],
            [
              "Webhook mode shows Unavailable",
              "Both X-Series and R-Series webhook endpoint formats returned 404 or 403 during registration. This is not expected on any Lightspeed POS plan per Lightspeed support.",
              "Verify webhooks from the detail page, then run diagnostics. If the webhook endpoint format check fails, contact Lightspeed support and reference their confirmation that webhooks are available on all plans.",
            ],
            [
              "Customer counts are lower than expected",
              "CRM linking only happens when usable email or phone data exists and the customer import has completed.",
              "Review the last customer sync timestamp and the stored Lightspeed customer records before assuming data loss.",
            ],
            [
              "Sales look stale despite Real-time webhook mode",
              "Recent sales sync has not run or webhooks are registered but events are not being delivered by Lightspeed.",
              "Check the 'Last event' timestamp in the Webhook Configuration section. If no events have been received, run diagnostics to verify the callback URL is reachable and the webhook secret is correctly configured.",
            ],
            [
              "Products show $0 price or 0 stock",
              "Product prices require expansion parameters in the API request, and stock counts come from a separate inventory endpoint.",
              "Trigger a manual sync. If prices remain $0 after sync, check the product sync worker logs for API response shape issues.",
            ],
          ]}
        />
      ),
    },
    {
      id: "reference-event-list",
      title: "Reference Event List",
      group: "Reference",
      content: (
        <div className="space-y-4">
          <DocCodeBlock
            language="text"
            code={lightspeedWebhookEvents}
            ariaLabel="Lightspeed reference event list"
          />
          <DocCallout title="Webhook registration subscribes to all events">
            When webhook creation succeeds, BloomSuite registers a single
            webhook endpoint and subscribes to all available event types rather
            than maintaining individual per-topic subscriptions. The webhook
            handler dispatches received events by type and ignores unrecognized
            event types with a log entry. This means new event types that
            Lightspeed adds in the future will be received and logged without
            requiring a code change.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "faq",
      title: "Frequently Asked Questions",
      group: "Reference",
      content: (
        <div className="space-y-5 text-[15px] leading-7 text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">
              Why does BloomSuite ask for a store prefix instead of a full URL?
            </p>
            <p>
              The Lightspeed OAuth start and callback flow is built around the
              store domain prefix and constructs the token and account URLs from
              that value. The prefix is the part before
              <DocInlineCode>.retail.lightspeed.app</DocInlineCode> in the store
              URL.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Does every Lightspeed account support webhooks?
            </p>
            <p>
              Yes. Lightspeed webhooks are available on all POS plans. Business
              Rules is a separate Plus-plan-only feature that is not related to
              BloomSuite&apos;s webhook integration. If webhook registration
              fails, use the "Verify webhooks" action to retry.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              What does Webhook Mode Unavailable mean?
            </p>
            <p>
              It means BloomSuite&apos;s webhook registration attempt failed for
              both the X-Series and R-Series endpoint formats. This should not
              normally occur on any Lightspeed POS plan. Use the "Verify
              webhooks" action to retry, and if the issue persists, run
              diagnostics to identify the specific API error.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              What is the difference between webhooks and Business Rules?
            </p>
            <p>
              Webhooks are event notifications that Lightspeed sends to
              BloomSuite when data changes (sales, customers, products). They
              are available on all POS plans. Business Rules are a separate
              Lightspeed feature for in-store workflow automation (e.g., loyalty
              triggers, discount rules) and are limited to Plus plan
              subscribers. BloomSuite uses webhooks, not Business Rules.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              What happens if webhook registration fails?
            </p>
            <p>
              BloomSuite falls back to sync-only mode, where data is updated
              through scheduled and manual background sync jobs. The "Verify
              webhooks" action can retry registration at any time without
              disconnecting the store.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Can I still use BloomSuite if the store is in sync-only mode?
            </p>
            <p>
              Yes. Customer, sales, and product sync paths continue to provide
              full retail data coverage. Sync-only mode means data updates
              arrive during scheduled or manual sync runs rather than in real
              time.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
