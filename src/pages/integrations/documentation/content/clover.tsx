import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

const cloverSeed = getIntegrationSeed("clover");

if (!cloverSeed) {
  throw new Error("Clover integration seed is missing.");
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

const cloverEventMap = [
  "ORDER_PAID -> payment.completed",
  "PAYMENT_PROCESSED -> payment.completed",
  "ORDER_CREATED -> order.created",
  "CUSTOMER_CREATED -> customer.created",
  "CUSTOMER_UPDATED -> customer.updated",
  "REFUND -> refund.created",
  "REFUND_CREATED -> refund.created",
  "INVENTORY_UPDATED -> inventory.updated",
  "LOYALTY_JOIN -> loyalty.join (stubbed)",
].join("\n");

export const cloverDocumentation: DocContent = {
  integrationName: cloverSeed.name,
  integrationSlug: cloverSeed.slug,
  category: cloverSeed.categoryLabel,
  pageTitle: "Clover Integration Guide",
  overview:
    "Connect Clover to BloomSuite to import customer, sales, and product activity from a Clover merchant account. The current Clover implementation supports region-aware OAuth, background sync jobs, app-level webhook monitoring, and a narrower real-time event surface than Square, so the docs need to describe both the working paths and the current operational limits clearly.",
  readingTimeMinutes: 15,
  lastUpdated: "Mar 23, 2026",
  branding: {
    icon: cloverSeed.icon,
  },
  sections: [
    {
      id: "overview",
      title: "Overview",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            Clover in BloomSuite is a merchant-facing POS integration backed by
            Clover OAuth, customer and sales sync jobs, a webhook handler, and a
            connection detail page that exposes connection testing, webhook
            mode, sync health, merchant details, and automation visibility.
          </p>
          <p>
            The current implementation is honest about Clover&apos;s biggest
            constraint: webhook subscriptions are not provisioned per merchant
            by API. Instead, BloomSuite tracks whether the Clover app itself is
            configured for webhooks and whether recent delivery has actually
            occurred.
          </p>
          <DocCallout title="Current operating model">
            Treat Clover as a mixed real-time and sync integration. OAuth,
            customer import, paid-order sync, and connection testing are real
            implementation paths today. Webhook behavior depends on app-level
            Clover configuration and recent delivery, not just on the merchant
            being connected.
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
                title: "Clover operator access",
                body: (
                  <p>
                    The person completing setup must be able to authorize a
                    Clover app connection for the target merchant account.
                  </p>
                ),
              },
              {
                title: "Correct Clover region",
                body: (
                  <p>
                    BloomSuite&apos;s OAuth start flow supports regional Clover
                    authorization endpoints. Confirm whether the merchant is in
                    North America, Europe, or Latin America before launching the
                    flow.
                  </p>
                ),
              },
              {
                title: "BloomSuite tenant access",
                body: (
                  <p>
                    The operator should be able to open the Clover integration
                    detail page and use the current post-connect actions such as
                    <DocInlineCode>Trigger manual sync</DocInlineCode> and
                    <DocInlineCode>Run connection test</DocInlineCode>.
                  </p>
                ),
              },
              {
                title: "App-level webhook review",
                body: (
                  <p>
                    If you expect real-time Clover delivery, confirm the Clover
                    app itself has webhook support configured. The merchant
                    connection alone does not create webhook subscriptions.
                  </p>
                ),
              },
            ]}
          />
          <DocCallout
            variant="warning"
            title="Do not assume per-merchant webhook setup"
          >
            Clover does not behave like Square in this repo. Webhook readiness
            is app-level and delivery-based, so a successful merchant OAuth flow
            can still leave the connection operating in sync-only mode.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "connecting-your-clover-account",
      title: "Connecting Your Clover Account",
      group: "Getting Started",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Open the Clover integration page",
                body: (
                  <p>
                    Start from BloomSuite&apos;s Integrations hub or the Clover
                    integration detail route. This ensures the OAuth flow is
                    associated with the correct tenant before the user leaves
                    the app.
                  </p>
                ),
              },
              {
                title: "Launch the Clover connect flow",
                body: (
                  <p>
                    BloomSuite calls the Clover OAuth start function, records a
                    pending connection for the tenant, and builds the
                    region-aware Clover authorization URL for the operator.
                  </p>
                ),
              },
              {
                title: "Complete Clover authorization",
                body: (
                  <p>
                    After Clover redirects back, BloomSuite exchanges the code,
                    fetches merchant details, stores encrypted tokens, and
                    immediately runs the webhook-state setup path.
                  </p>
                ),
              },
              {
                title: "Confirm merchant details in BloomSuite",
                body: (
                  <p>
                    Use the Clover detail page to confirm Merchant Name,
                    Merchant ID, Employee ID, Region, Environment, and the
                    current webhook mode before enabling downstream automations.
                  </p>
                ),
              },
            ]}
          />
          <DocCallout
            variant="success"
            title="Pending connections are cleaned up automatically"
          >
            The OAuth start flow deletes older pending Clover connection rows
            for the tenant before inserting a new one, which keeps the current
            connection attempt deterministic.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "webhook-setup-and-verification",
      title: "Webhook Setup and Verification",
      group: "Configuration",
      content: (
        <div className={proseClassName}>
          <p>
            Clover webhook setup in BloomSuite is not a merchant-scoped
            subscription flow. The repo&apos;s
            <DocInlineCode>ensureCloverWebhooks</DocInlineCode> logic checks for
            an app-level Clover configuration, records the app ID as a webhook
            reference when present, and marks the connection as verified only
            after real delivery is observed.
          </p>
          <p>
            If <DocInlineCode>CLOVER_APP_ID</DocInlineCode> is missing,
            BloomSuite explicitly classifies the connection as sync-only and
            records the reason in the connection state. If the app ID exists but
            no webhook has been received recently, the connection stays in a
            pending verification state.
          </p>
          <DocCallout title="Verification is delivery-based">
            BloomSuite considers Clover webhooks verified only when a webhook
            has been received within the last 24 hours. App configuration alone
            does not move the connection into a trustworthy real-time state.
          </DocCallout>
          <DocCallout
            variant="warning"
            title="Signature handling is still conservative"
          >
            The Clover webhook handler contains signature verification logic and
            fallback header assumptions, but some Clover-specific signature
            details are still treated cautiously in code. If delivery succeeds
            but validation looks wrong, escalate instead of weakening the
            security assumptions in docs or runtime.
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
            Clover sync is split into dedicated customer, sales, and product
            flows. The current detail page reports the last customer, sales, and
            product sync timestamps and exposes a
            <DocInlineCode>Trigger manual sync</DocInlineCode> action for
            operator-driven refresh.
          </p>
          <p>
            Customer sync runs through a paginated job model. Sales sync pulls
            paid orders and updates downstream order and customer metrics.
            Product sync is implemented as a separate background path and is
            surfaced in the same connection summary even though its behavior is
            lighter than Square&apos;s catalog model.
          </p>
          <DocCallout title="Use sync logs before guessing">
            If record counts or timestamps look stale, start from
            <DocInlineCode>View sync logs</DocInlineCode> on the Clover detail
            page rather than assuming the issue is with OAuth or automation.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "customer-sync-behavior",
      title: "Customer Sync Behavior",
      group: "Data & Sync",
      content: (
        <div className="space-y-4">
          <p className="text-[15px] leading-7 text-muted-foreground">
            Clover customer sync is deliberately conservative. The customer sync
            job expands email addresses, phone numbers, and addresses, then
            deduplicates the current page by lowercased email before upserting
            CRM customers.
          </p>
          <DocTable
            headers={["Behavior", "Current Implementation"]}
            rows={[
              [
                "Primary identity key",
                "Email address when available, normalized to lowercase before upsert.",
              ],
              [
                "Customers without email",
                "Skipped during the main customer sync job and logged as skipped-no-email cases.",
              ],
              [
                "Phone capture",
                "Primary phone number is stored when present and can support later CRM matching.",
              ],
              [
                "CRM destination",
                <>
                  <DocInlineCode>crm_customers</DocInlineCode> with
                  <DocInlineCode>clover_customer_id</DocInlineCode> and
                  provider-specific sync timestamps.
                </>,
              ],
              [
                "Duplicate protection",
                "Batch-level deduplication keeps a single row per email to avoid repeated UPSERT conflicts from Clover responses.",
              ],
            ]}
          />
        </div>
      ),
    },
    {
      id: "orders-payments-and-refunds",
      title: "Orders, Payments, and Refunds",
      group: "Data & Sync",
      content: (
        <div className={proseClassName}>
          <p>
            Clover paid-order sync fetches orders filtered to paid payment
            state, writes them into
            <DocInlineCode>pos_orders</DocInlineCode>, and updates customer
            lifetime value and purchase dates when a Clover customer match
            exists.
          </p>
          <p>
            Real-time payment handling follows a similar path. The Clover
            webhook handler stores order records, attempts to match or update a
            CRM customer, and then fires purchase-oriented automation triggers.
          </p>
          <p>
            Refund webhook events update the stored order state, subtract refund
            value from customer spend metrics, and fire
            <DocInlineCode>refund.created</DocInlineCode> for matched customers.
          </p>
        </div>
      ),
    },
    {
      id: "inventory-and-products",
      title: "Inventory and Products",
      group: "Data & Sync",
      content: (
        <div className={proseClassName}>
          <p>
            Clover inventory webhook handling is item-level. When an inventory
            update arrives, BloomSuite looks up the matching product by external
            item ID and updates inventory count plus tracking state.
          </p>
          <p>
            Sales sync also extracts product names from line items and uses them
            to update CRM customer product tags. That means product data affects
            both product inventory state and the customer profile shape used by
            downstream segments and automations.
          </p>
        </div>
      ),
    },
    {
      id: "automation-triggers",
      title: "Automation Triggers",
      group: "Automations",
      content: (
        <div className={proseClassName}>
          <p>
            Clover webhook processing currently routes into BloomSuite
            automation triggers for completed payments, first purchases, review
            requests, refunds, and a placeholder loyalty join path.
          </p>
          <DocCodeBlock
            language="text"
            code={cloverEventMap}
            ariaLabel="Clover event map"
          />
          <DocCallout title="Loyalty is intentionally conservative">
            The Clover loyalty join handler exists as a stubbed path in the
            webhook handler. It can tag existing matched customers and fire the
            legacy loyalty trigger, but the docs should not describe Clover
            loyalty coverage as fully mature real-time behavior.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "connection-testing-and-operations",
      title: "Connection Testing and Operations",
      group: "Automations",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Run connection test",
                body: (
                  <p>
                    Use <DocInlineCode>Run connection test</DocInlineCode> from
                    the Clover detail page when you need a quick operational
                    read on the current connection.
                  </p>
                ),
              },
              {
                title: "Check webhook mode",
                body: (
                  <p>
                    Review whether the detail page shows
                    <DocInlineCode>Real-time</DocInlineCode> or
                    <DocInlineCode>Sync only</DocInlineCode>. This tells you
                    whether BloomSuite has recent evidence of webhook delivery.
                  </p>
                ),
              },
              {
                title: "Use activity destinations already in the UI",
                body: (
                  <p>
                    Open sync logs for import behavior and automation logs for
                    downstream CRM behavior before escalating application bugs.
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
              "OAuth completes but webhook mode shows Sync only",
              "App-level Clover webhook configuration is missing or no webhook has been received yet",
              "Confirm Clover app webhook setup first, then wait for or trigger real activity and re-check the detail page.",
            ],
            [
              "Customer import count looks lower than Clover",
              "Customers without email are skipped by the current customer sync job",
              "Treat this as current implementation behavior, not silent data loss. Review whether email-free contacts should be handled in a follow-up milestone.",
            ],
            [
              "Payment automations do not fire",
              "Customer matching failed or the automation is not configured for Clover-triggered purchase paths",
              "Check CRM matching first, then verify the automation workflow and webhook logs.",
            ],
            [
              "Connection test is partial",
              "The current Clover test surface found only some expected capabilities",
              "Use the test result as a diagnostic signal and review sync logs, webhook mode, and merchant details together.",
            ],
          ]}
        />
      ),
    },
    {
      id: "supported-event-types",
      title: "Supported Event Types",
      group: "Reference",
      content: (
        <div className="space-y-4">
          <DocCodeBlock
            language="text"
            code={cloverEventMap}
            ariaLabel="Supported Clover event types"
          />
          <DocCallout title="Event support is narrower than marketing language might imply">
            Order creation, payment completion, customers, refunds, inventory,
            and a provisional loyalty path are the current real-time Clover
            surfaces visible in code. Keep documentation aligned to those paths
            unless the runtime is expanded.
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
              Why does Clover say connected if webhooks are not verified?
            </p>
            <p>
              OAuth completion and webhook verification are separate states in
              the current implementation. A merchant can be connected while the
              webhook mode remains sync-only or pending first delivery.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Does BloomSuite create Clover webhooks for each merchant?
            </p>
            <p>
              No. The current code treats Clover webhooks as an app-level
              concern and records status on the merchant connection after
              checking for app configuration and actual delivery.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Why are some Clover customers missing after sync?
            </p>
            <p>
              The customer sync job skips customers without email because the
              current deduplication and CRM upsert path is email-led.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Is Clover loyalty fully supported?
            </p>
            <p>
              Not in the same way as payments or refunds. The code contains a
              loyalty join placeholder path, so describe it as partial rather
              than as complete real-time loyalty automation coverage.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
