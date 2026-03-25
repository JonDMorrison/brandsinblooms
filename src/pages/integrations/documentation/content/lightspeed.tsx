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
    "Webhook exists and verifies as enabled in the Lightspeed account.",
    "Expect webhook delivery plus background sync paths.",
  ],
  [
    "Sync only",
    "The account is connected but webhook verification is pending or not confirmed.",
    "Use manual and scheduled sync paths while reviewing webhook health.",
  ],
  [
    "Unavailable",
    "The Lightspeed Webhook API is not available for this account type or store.",
    "Treat the integration as connected without real-time webhook delivery.",
  ],
];

export const lightspeedDocumentation: DocContent = {
  integrationName: lightspeedSeed.name,
  integrationSlug: lightspeedSeed.slug,
  category: lightspeedSeed.categoryLabel,
  pageTitle: "Lightspeed X-Series Integration Guide",
  overview:
    "Connect Lightspeed X-Series to BloomSuite to sync retail customers, sales, products, and selected real-time updates from a store-specific domain. The current implementation supports domain-prefix-driven OAuth, automatic webhook provisioning when the account allows it, and background sync paths that keep the integration useful even when webhook support is limited or unavailable.",
  readingTimeMinutes: 16,
  lastUpdated: "Mar 23, 2026",
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
            Compared with Square, Lightspeed in this repo is more account-
            dependent. The code can create and verify webhooks when the account
            exposes the Webhook API, but it also explicitly supports degraded
            modes where the integration remains usable through background syncs
            even though real-time delivery is reduced or unavailable.
          </p>
          <DocCallout title="Current operating model">
            Lightspeed should be documented as an account-sensitive integration.
            OAuth and core sync behavior are live. Webhook behavior varies by
            account and is reflected back to the UI as
            <DocInlineCode>Real-time</DocInlineCode>,
            <DocInlineCode>Sync only</DocInlineCode>, or
            <DocInlineCode>Unavailable</DocInlineCode>.
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
                    Before rollout, assume webhook support may vary by account.
                    The current code handles this explicitly and does not treat
                    webhook API access as universal.
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
                    domain prefix, tokens, connection state, and current webhook
                    result. Review the Lightspeed detail page before assuming
                    the store is operating in full real-time mode.
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
            step when the account supports the API.
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
            Lightspeed webhook setup is automatic when the connected account
            exposes the Webhook API. BloomSuite lists existing webhooks, reuses
            or enables a matching webhook when possible, creates a new webhook
            when needed, and then verifies that the webhook exists and is
            enabled.
          </p>
          <DocTable
            headers={["Webhook Mode", "Meaning", "How to Operate"]}
            rows={webhookModeMatrix}
          />
          <DocCallout title="Account capability changes the mode">
            If the Lightspeed API returns 403 or 404 for webhook listing,
            BloomSuite records that as a sync-only condition rather than a hard
            connection failure. The detail page can still surface the webhook
            mode as unavailable to make that limitation explicit to operators.
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
            <DocInlineCode>Trigger manual sync</DocInlineCode> action when the
            connection is active.
          </p>
          <p>
            Customer sync paginates through customer records and links them into
            BloomSuite CRM contacts. Sales sync pulls recent completed sales and
            derives purchase metrics such as first purchase date and total
            spend. Product sync exists as a separate path and complements the
            real-time product update handler.
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
            The current real-time handler is lighter than the full sync surface,
            which means the docs should distinguish between events that can be
            received in real time and the broader record coverage that arrives
            through import jobs.
          </p>
          <DocCodeBlock
            language="text"
            code={lightspeedWebhookEvents}
            ariaLabel="Lightspeed webhook event coverage"
          />
          <DocCallout
            variant="warning"
            title="Webhook parity is not the same as sync parity"
          >
            Real-time Lightspeed events update sales, customers, products, and
            loyalty balance when received, but the background sync jobs still do
            most of the heavier import and metric-building work.
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
            Lightspeed sales sync updates purchase count, total spend, first
            purchase date, and last purchase date for matched Lightspeed
            customers. That means first-purchase semantics exist in the synced
            customer data model even though the webhook handler itself is more
            lightweight than the Square automation pipeline.
          </p>
          <p>
            Use Lightspeed data as a source for reporting and customer-state
            enrichment first. If you need heavier real-time marketing behavior,
            validate the exact runtime path in the current app instead of
            assuming full parity with Square automation triggers.
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
                title: "Review Webhook Mode first",
                body: (
                  <p>
                    Check whether the connection is operating as Real-time, Sync
                    only, or Unavailable before you diagnose stale data.
                  </p>
                ),
              },
              {
                title: "Use Run diagnostics",
                body: (
                  <p>
                    The Lightspeed detail page exposes
                    <DocInlineCode>Run diagnostics</DocInlineCode> as the main
                    operator action for deeper investigation beyond basic sync
                    timestamps.
                  </p>
                ),
              },
              {
                title: "Trigger manual sync when appropriate",
                body: (
                  <p>
                    If the store is connected but current data is stale, use
                    <DocInlineCode>Trigger manual sync</DocInlineCode> before
                    escalating webhook-specific issues.
                  </p>
                ),
              },
              {
                title: "Use store and activity references already in the UI",
                body: (
                  <p>
                    Review the Store URL, sync logs, and diagnostics destination
                    shown in the existing Lightspeed detail page before changing
                    configuration assumptions.
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
              "The domain prefix is wrong, the callback URI is mismatched, or the state token has expired",
              "Restart the connect flow from BloomSuite and confirm the exact store prefix before retrying.",
            ],
            [
              "Store is connected but webhook mode is Unavailable",
              "This account does not expose the Lightspeed Webhook API for BloomSuite to manage",
              "Treat the connection as sync-driven and use manual or scheduled sync behavior instead of expecting real-time delivery.",
            ],
            [
              "Customer counts are lower than expected",
              "CRM linking only happens when usable email or phone data exists and the customer import has completed",
              "Review the last customer sync and the stored Lightspeed customer records before assuming data loss.",
            ],
            [
              "Sales look stale",
              "Recent sales sync has not run or is failing before persisting updated sales rows",
              "Trigger manual sync, then inspect sync logs or diagnostics before altering connection settings.",
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
          <DocCallout title="Automatic provisioning uses a single webhook endpoint">
            When webhook creation is allowed, BloomSuite creates or reuses a
            webhook pointing at the shared Lightspeed webhook handler and
            enables it for all events rather than maintaining a merchant-managed
            list of individual subscriptions in the UI.
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
              that value.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Does every Lightspeed account support webhooks?
            </p>
            <p>
              No. The current code explicitly handles accounts where the Webhook
              API is unavailable and keeps the connection usable through sync
              paths instead.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              What does Webhook Mode Unavailable mean?
            </p>
            <p>
              It means BloomSuite could not use the Lightspeed Webhook API for
              this account. The connection can still exist, but you should not
              expect real-time event delivery.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Can I still use BloomSuite if the store is sync-only?
            </p>
            <p>
              Yes. The current implementation includes customer, sales, and
              product sync paths that continue to provide useful retail data
              even when webhook capability is reduced.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
