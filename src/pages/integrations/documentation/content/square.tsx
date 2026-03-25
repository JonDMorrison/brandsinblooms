import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { documentationLogoAssets } from "@/pages/integrations/documentation/content/logoAssets";

const squareSeed = getIntegrationSeed("square");

if (!squareSeed) {
  throw new Error("Square integration seed is missing.");
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

const oauthScopeBlock = [
  "MERCHANT_PROFILE_READ",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
  "PAYMENTS_READ",
  "ITEMS_READ",
  "ORDERS_READ",
  "LOYALTY_READ",
].join("\n");

const subscribedWebhookEvents = [
  "payment.created",
  "payment.completed",
  "payment.updated",
  "order.created",
  "order.updated",
  "order.fulfillment.updated",
  "customer.created",
  "customer.updated",
  "loyalty.account.created",
  "loyalty.program.enrollment.created",
  "refund.created",
  "catalog.version.updated",
  "inventory.count.updated",
].join("\n");

export const squareDocumentation: DocContent = {
  integrationName: squareSeed.name,
  integrationSlug: squareSeed.slug,
  category: squareSeed.categoryLabel,
  pageTitle: "Square Integration Guide",
  overview:
    "Connect your Square merchant account to BloomSuite to sync customers, payments, orders, loyalty activity, and catalog changes into your CRM workflows. Square is the most complete POS integration currently exposed in BloomSuite's integrations shell, with automatic webhook setup, customer matching, and automation hooks tied to the existing CRM pipeline.",
  readingTimeMinutes: 18,
  lastUpdated: "2026-01-15",
  branding: {
    icon: squareSeed.icon,
    logoSrc: documentationLogoAssets.square,
    logoAlt: "Square logo",
  },
  sections: [
    {
      id: "overview",
      title: "Overview",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            Square is BloomSuite&apos;s most mature POS connection in the
            current codebase. When Square is connected, BloomSuite stores
            merchant connection metadata, processes webhook deliveries, syncs
            customers, orders, products, and loyalty activity, and exposes
            troubleshooting controls from the Square integration detail page.
          </p>
          <p>
            In the live implementation, Square activity is routed through a
            merchant-specific connection record, matched against existing CRM
            customers, and then passed into BloomSuite&apos;s automation layer
            using trigger types such as{" "}
            <DocInlineCode>payment.completed</DocInlineCode>,{" "}
            <DocInlineCode>first_purchase</DocInlineCode>,{" "}
            <DocInlineCode>loyalty_join</DocInlineCode>, and{" "}
            <DocInlineCode>refund.created</DocInlineCode>.
          </p>
          <DocCallout title="Implementation note">
            Square is the only POS integration in this repo with automatic
            webhook provisioning, webhook verification controls, and direct CRM
            automation triggers already wired into the current detail-page
            experience.
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
                title: "Square merchant account",
                body: (
                  <p>
                    You need an active Square merchant account that you are
                    authorized to connect. The current OAuth edge-function flow
                    in this repo is configured for production credentials, so
                    treat test-only or sandbox validation as an engineering
                    review task rather than a self-serve setup path.
                  </p>
                ),
              },
              {
                title: "BloomSuite admin access",
                body: (
                  <p>
                    The person completing setup should be able to access the
                    BloomSuite integrations area and review the Square detail
                    page after connection.
                  </p>
                ),
              },
              {
                title: "OAuth-based connection flow",
                body: (
                  <p>
                    BloomSuite uses its own Square application. You do not need
                    to create a separate Square app or paste API keys into the
                    UI.
                  </p>
                ),
              },
              {
                title: "Email infrastructure readiness for automations",
                body: (
                  <p>
                    If you plan to send email automations from Square purchase
                    or loyalty events, verify your sending domain in
                    BloomSuite&apos;s email infrastructure first so the
                    automation workflow has a production-ready outbound path.
                  </p>
                ),
              },
            ]}
          />
          <DocCallout variant="warning" title="Environment caution">
            The current Square OAuth start and callback functions are forced to
            production mode in the implementation. Do not use a live merchant
            connection for exploratory testing if your goal is sandbox-only
            validation.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "connecting-your-square-account",
      title: "Connecting Your Square Account",
      group: "Getting Started",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Navigate to the Square integration page",
                body: (
                  <p>
                    From the Integrations hub, open the Square card or the
                    Square integration detail page. Use that page as your source
                    of truth before and after the connection flow.
                  </p>
                ),
              },
              {
                title: "Click Connect Square",
                body: (
                  <p>
                    Launch the BloomSuite-controlled OAuth flow. BloomSuite
                    opens Square&apos;s authorization screen in a new tab and
                    stores a pending connection record before redirecting you
                    away from the app.
                  </p>
                ),
              },
              {
                title: "Approve the requested Square scopes",
                body: (
                  <div className="space-y-4">
                    <p>
                      The current OAuth implementation requests the following
                      scopes from Square:
                    </p>
                    <DocCodeBlock
                      language="text"
                      code={oauthScopeBlock}
                      ariaLabel="Square OAuth scopes"
                    />
                  </div>
                ),
              },
              {
                title: "Return to BloomSuite and confirm connection state",
                body: (
                  <p>
                    After Square redirects back, BloomSuite exchanges the code
                    for tokens, retrieves merchant details, stores encrypted
                    credentials, and attempts webhook setup automatically. Use
                    the Square detail page to confirm Merchant Name,
                    Environment, and webhook health before assuming the
                    connection is ready.
                  </p>
                ),
              },
            ]}
          />
          <DocCallout variant="success" title="Automatic webhook attempt">
            BloomSuite attempts webhook setup immediately after OAuth completes.
            If the subscription is missing or degraded later, use the
            <DocInlineCode>Verify webhooks</DocInlineCode> action from the
            Square detail page instead of configuring a webhook manually.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "webhook-setup",
      title: "Webhook Setup",
      group: "Configuration",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite uses a shared Square webhook endpoint and routes events
            to the correct merchant connection using the merchant context in the
            incoming payload. Webhook creation is handled by the Square OAuth
            callback and the Square webhook management function rather than by a
            manual operator dashboard flow.
          </p>
          <p>
            On the Square integration detail page, the current implementation
            exposes a <strong>Webhook Subscription Status</strong> panel with
            the fields <strong>Subscription State</strong>,{" "}
            <strong>Subscription ID</strong>, <strong>Last Checked</strong>,{" "}
            <strong>Last Event</strong>, <strong>Retry Queue</strong>, and{" "}
            <strong>Next Retry</strong>.
          </p>
          <DocCallout title="Manual verification path">
            If webhook delivery looks stale or incomplete, use the
            <DocInlineCode>Verify webhooks</DocInlineCode> action from the
            Square detail page. BloomSuite will re-check the existing
            subscription and attempt to repair it if required.
          </DocCallout>
          <DocCallout
            variant="warning"
            title="Signature verification depends on configuration"
          >
            The webhook handler verifies Square signatures when the Square
            webhook signature secret is configured. If support suspects that
            secret is missing or misconfigured, treat the connection as needing
            operator review instead of assuming every event is being verified.
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
            Square sync currently runs in two layers. Webhooks deliver real-time
            signals for payments, customers, loyalty activity, refunds,
            inventory, and catalog changes. Background sync jobs provide a
            fallback path for customer, order, and product refreshes.
          </p>
          <p>
            The Square detail page surfaces a{" "}
            <strong>Sync Configuration</strong>
            panel that reports the last customer, sales, and product sync
            timestamps plus synced record counts for each domain.
          </p>
          <p>
            To trigger a fresh run, use the{" "}
            <DocInlineCode>Trigger manual sync</DocInlineCode>
            action from the Square detail page. To inspect recent jobs, open
            <DocInlineCode>View sync logs</DocInlineCode> from the same actions
            menu.
          </p>
        </div>
      ),
    },
    {
      id: "automation-triggers",
      title: "Automation Triggers",
      group: "Configuration",
      content: (
        <div className={proseClassName}>
          <p>
            Square webhook handlers feed BloomSuite&apos;s existing automation
            system. For qualifying events, BloomSuite matches a customer,
            updates order or CRM state, and then fires the trigger types that
            correspond to the event.
          </p>
          <p>
            For completed payments, the current implementation fires
            <DocInlineCode>payment.completed</DocInlineCode> and adds{" "}
            <DocInlineCode>first_purchase</DocInlineCode> when the matched
            customer did not previously have a first purchase date. Loyalty
            events fire <DocInlineCode>loyalty_join</DocInlineCode>, refunds
            fire <DocInlineCode>refund.created</DocInlineCode>, and fulfillment
            updates can fire{" "}
            <DocInlineCode>order.ready_for_pickup</DocInlineCode>
            or <DocInlineCode>order.shipped</DocInlineCode>.
          </p>
          <DocCallout title="Payment status matters">
            BloomSuite only fires purchase automations from the completed
            payment path. A payment created event by itself is not documented as
            an automation trigger in the current implementation.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "what-gets-synced",
      title: "What Gets Synced",
      group: "Data & Sync",
      content: (
        <div className="space-y-4">
          <DocTable
            headers={[
              "Data Type",
              "Sync Method",
              "Direction",
              "BloomSuite Destination",
            ]}
            rows={[
              [
                "Customer profiles",
                "Webhook + background sync",
                "Square → BloomSuite",
                <>
                  <DocInlineCode>crm_customers</DocInlineCode>
                </>,
              ],
              [
                "Orders and payments",
                "Webhook + background sync",
                "Square → BloomSuite",
                <>
                  <DocInlineCode>pos_orders</DocInlineCode>
                </>,
              ],
              [
                "Customer groups",
                "Webhook + background sync",
                "Square → BloomSuite",
                "Customer tags and stored Square group IDs",
              ],
              [
                "Loyalty membership",
                "Webhook",
                "Square → BloomSuite",
                "CRM tags, loyalty segment assignment, and loyalty automation triggers",
              ],
              [
                "Product catalog",
                "Catalog change notification + background sync",
                "Square → BloomSuite",
                <>
                  <DocInlineCode>products</DocInlineCode> and{" "}
                  <DocInlineCode>product_variations</DocInlineCode>
                </>,
              ],
              [
                "Inventory counts",
                "Webhook",
                "Square → BloomSuite",
                "Product inventory updates",
              ],
              [
                "Refund status",
                "Webhook",
                "Square → BloomSuite",
                "Order refund state and customer value metrics",
              ],
            ]}
          />
          <DocCallout title="Not currently documented as synced">
            This page does not treat team-management data, banking data, payout
            data, or Square marketing campaigns as part of the current
            BloomSuite Square sync contract.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "customer-identity-resolution",
      title: "Customer Identity Resolution",
      group: "Data & Sync",
      content: (
        <div className="space-y-6">
          <p className="text-[15px] leading-7 text-muted-foreground">
            When a Square payment or invoice event reaches BloomSuite, the
            webhook handler uses a four-step identity cascade before deciding
            whether to create a CRM record.
          </p>
          <StepList
            steps={[
              {
                title: "Match by email",
                body: (
                  <p>
                    If the event contains an email address, BloomSuite first
                    looks for an existing{" "}
                    <DocInlineCode>crm_customers</DocInlineCode>
                    record for the current tenant with that email.
                  </p>
                ),
              },
              {
                title: "Match by Square customer ID",
                body: (
                  <p>
                    If no email match is found, BloomSuite checks the stored
                    <DocInlineCode>square_customer_id</DocInlineCode> on CRM
                    customers.
                  </p>
                ),
              },
              {
                title: "Match by phone number",
                body: (
                  <p>
                    If email and Square customer ID do not resolve a record,
                    BloomSuite checks the phone number attached to the event.
                  </p>
                ),
              },
              {
                title: "Fetch from Square API and create when possible",
                body: (
                  <p>
                    If the event includes a Square customer ID and BloomSuite
                    has access to the connection token, the handler fetches the
                    customer from Square and creates a CRM record when the
                    returned profile contains enough contact data to do so.
                  </p>
                ),
              },
            ]}
          />
          <p className="text-[15px] leading-7 text-muted-foreground">
            When a match succeeds, BloomSuite updates purchase dates, total
            spend, lifetime value, and the linked Square customer ID for future
            lookups.
          </p>
        </div>
      ),
    },
    {
      id: "orders-payments",
      title: "Orders & Payments",
      group: "Data & Sync",
      content: (
        <div className="space-y-4">
          <p className="text-[15px] leading-7 text-muted-foreground">
            Completed Square payments and invoice payment events are recorded in
            <DocInlineCode>pos_orders</DocInlineCode>. BloomSuite uses the
            combination of <DocInlineCode>external_id</DocInlineCode> and{" "}
            <DocInlineCode>pos_connection_id</DocInlineCode> as the idempotent
            order key so duplicate deliveries do not create duplicate order
            records.
          </p>
          <DocCodeBlock
            language="text"
            code={[
              "external_id          - Square payment ID or invoice ID",
              "pos_connection_id    - BloomSuite Square connection ID",
              "customer_external_id - Linked Square customer ID when available",
              "total_amount         - Order or invoice total",
              "currency             - Currency code from Square",
              "status               - Current order state, including refund updates",
              "raw_data             - Stored event or invoice payload",
              "raw_data.triggers_fired - Idempotency marker for automation firing",
            ].join("\n")}
            ariaLabel="Square order storage reference"
          />
          <DocCallout title="Invoice payments follow the payment path">
            The current invoice payment handler stores invoice records in
            <DocInlineCode>pos_orders</DocInlineCode> and fires the same
            purchase-style automation triggers used by the completed payment
            path when customer matching succeeds.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "products-inventory",
      title: "Products & Inventory",
      group: "Data & Sync",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite stores Square product and variation data in the products
            tables and updates inventory in response to Square inventory webhook
            deliveries.
          </p>
          <p>
            Catalog changes are not processed inline as a full payload refresh.
            When BloomSuite receives{" "}
            <DocInlineCode>catalog.version.updated</DocInlineCode>, it enqueues
            a background products sync job. This keeps webhook handling fast and
            lets the full catalog sync run separately.
          </p>
          <p>
            Inventory updates from{" "}
            <DocInlineCode>inventory.count.updated</DocInlineCode>
            are handled as direct item-level updates so product availability can
            be refreshed without a full catalog pull.
          </p>
        </div>
      ),
    },
    {
      id: "loyalty-program",
      title: "Loyalty Program",
      group: "Data & Sync",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite listens for Square loyalty account creation and
            enrollment events. When those events arrive, BloomSuite fetches the
            linked Square customer, matches or creates a CRM record, tags that
            customer as <DocInlineCode>Loyalty Member</DocInlineCode>, and then
            fires the legacy <DocInlineCode>loyalty_join</DocInlineCode>
            automation trigger.
          </p>
          <p>
            If the tenant has an existing CRM segment whose name matches
            loyalty-oriented naming such as Perks or Loyalty, BloomSuite also
            attempts to add the customer to that segment as part of the loyalty
            event flow.
          </p>
        </div>
      ),
    },
    {
      id: "supported-trigger-events",
      title: "Supported Trigger Events",
      group: "Automations",
      content: (
        <DocTable
          headers={["Square Event", "BloomSuite Trigger", "Current Behavior"]}
          rows={[
            [
              <DocInlineCode>payment.completed</DocInlineCode>,
              <>
                <DocInlineCode>payment.completed</DocInlineCode> and{" "}
                <DocInlineCode>first_purchase</DocInlineCode>
              </>,
              "Completed payments fire purchase triggers, and first-time purchasers also receive the first_purchase trigger.",
            ],
            [
              <DocInlineCode>invoice.payment_made</DocInlineCode>,
              <>
                <DocInlineCode>payment.completed</DocInlineCode> and{" "}
                <DocInlineCode>first_purchase</DocInlineCode>
              </>,
              "Invoice payments are handled through the invoice webhook path and reuse the same purchase-style trigger behavior when delivered.",
            ],
            [
              <DocInlineCode>order.fulfillment.updated</DocInlineCode>,
              <>
                <DocInlineCode>order.ready_for_pickup</DocInlineCode> or{" "}
                <DocInlineCode>order.shipped</DocInlineCode>
              </>,
              "Pickup orders fire ready_for_pickup when prepared; shipment orders fire order.shipped when completed.",
            ],
            [
              <DocInlineCode>refund.created</DocInlineCode>,
              <DocInlineCode>refund.created</DocInlineCode>,
              "Refund events update the order, decrement customer value metrics, and fire a refund automation trigger.",
            ],
            [
              <>
                <DocInlineCode>loyalty.account.created</DocInlineCode> and{" "}
                <DocInlineCode>
                  loyalty.program.enrollment.created
                </DocInlineCode>
              </>,
              <DocInlineCode>loyalty_join</DocInlineCode>,
              "Loyalty membership events tag the customer and fire the loyalty_join trigger.",
            ],
            [
              <DocInlineCode>customer.created</DocInlineCode>,
              <DocInlineCode>customer.created</DocInlineCode>,
              "New customer creation can feed customer-created automations after the CRM record is stored.",
            ],
          ]}
        />
      ),
    },
    {
      id: "first-purchase-automation",
      title: "First Purchase Automation",
      group: "Automations",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Create a Square automation",
                body: (
                  <p>
                    In CRM Automations, create a workflow that uses Square as
                    the source and the first-purchase event path as the trigger.
                  </p>
                ),
              },
              {
                title: "Use first-order logic",
                body: (
                  <p>
                    The webhook handler sets the first-purchase condition when a
                    matched customer record did not already have a first
                    purchase date before the completed payment arrived.
                  </p>
                ),
              },
              {
                title: "Personalize the workflow",
                body: (
                  <p>
                    Build the message around existing BloomSuite customer and
                    order data, then monitor automation logs from the Square
                    detail page if you need to confirm that events are entering
                    the automation pipeline.
                  </p>
                ),
              },
            ]}
          />
          <DocCallout variant="success" title="Quick-start template available">
            The Square quick automation templates in this repo include a
            first-purchase welcome automation labeled
            <DocInlineCode>First Purchase Thank You</DocInlineCode>.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "loyalty-join-automation",
      title: "Loyalty Join Automation",
      group: "Automations",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Create a loyalty automation",
                body: (
                  <p>
                    Configure an automation that listens for the
                    <DocInlineCode>loyalty_join</DocInlineCode> trigger.
                  </p>
                ),
              },
              {
                title: "Confirm loyalty enrollment handling",
                body: (
                  <p>
                    The current implementation can fire loyalty_join from both
                    loyalty account creation and loyalty enrollment webhook
                    events.
                  </p>
                ),
              },
              {
                title: "Check the CRM side effects",
                body: (
                  <p>
                    After a loyalty event, verify the customer received the
                    Loyalty Member tag and, when available, was added to the
                    tenant&apos;s loyalty-oriented CRM segment.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "refund-automation",
      title: "Refund Automation",
      group: "Automations",
      content: (
        <div className={proseClassName}>
          <p>
            When Square sends a refund event, BloomSuite updates the matching
            order, stores refund amount and reason, and decrements both
            <DocInlineCode>lifetime_value</DocInlineCode> and{" "}
            <DocInlineCode>total_spent</DocInlineCode> on the linked CRM
            customer before firing <DocInlineCode>refund.created</DocInlineCode>
            .
          </p>
          <DocCallout variant="warning" title="Refund messaging needs care">
            Refund automation exists as a trigger path, but the message content
            should be operational and empathetic. Treat it as a service message,
            not as a promotional send.
          </DocCallout>
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
              "OAuth flow does not complete",
              "Popup blocking, expired auth tab, or callback mismatch",
              "Retry the BloomSuite OAuth flow from the Square setup page and confirm the authorization tab completed successfully.",
            ],
            [
              "Connected state appears, but webhook health is degraded",
              "Webhook subscription creation failed or drifted after the original OAuth flow",
              "Use Verify webhooks from the Square detail page and then refresh the panel.",
            ],
            [
              "Customers are not appearing in CRM",
              "No qualifying customer sync or purchase activity has been processed yet",
              "Review sync timestamps, then run Trigger manual sync and inspect View sync logs.",
            ],
            [
              "Duplicate CRM records",
              "Square customer records differ by email or phone and do not collapse into a single conservative match",
              "Review the CRM records and merge them manually if they represent the same person.",
            ],
            [
              "Automations are not firing",
              "The event did not produce a matched trigger, or the automation is inactive",
              "Check automation configuration, then compare Square activity with automation logs and sync logs.",
            ],
          ]}
        />
      ),
    },
    {
      id: "webhook-health-problems",
      title: "Webhook Health Problems",
      group: "Troubleshooting",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Open the Webhook Subscription Status panel",
                body: (
                  <p>
                    Review Subscription State, Last Event, Retry Queue, and any
                    visible last webhook error on the Square detail page.
                  </p>
                ),
              },
              {
                title: "Run Verify webhooks",
                body: (
                  <p>
                    Use the existing Verify webhooks action instead of editing
                    webhook settings outside BloomSuite. This follows the same
                    subscription-management path the repo already uses.
                  </p>
                ),
              },
              {
                title: "Compare recent Square activity with Last Event",
                body: (
                  <p>
                    If Square is processing payments but BloomSuite&apos;s Last
                    Event timestamp remains stale, treat the issue as a delivery
                    or subscription problem rather than an automation bug.
                  </p>
                ),
              },
              {
                title: "Escalate with the identifiers already shown in the UI",
                body: (
                  <p>
                    Include Merchant ID, Subscription ID when present, and the
                    exact last webhook error text from the Square detail page in
                    any support handoff.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "sync-errors",
      title: "Sync Errors",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            If the Square sync timestamps are stale or a sync domain has not
            moved recently, start with the controls already exposed in the
            Square detail page.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground">
            <li>
              Use <DocInlineCode>Trigger manual sync</DocInlineCode>.
            </li>
            <li>
              Open <DocInlineCode>View sync logs</DocInlineCode> and review the
              latest job.
            </li>
            <li>
              Refresh the detail page to confirm whether the sync timestamps
              changed.
            </li>
            <li>
              If webhook health also looks degraded, run{" "}
              <DocInlineCode>Verify webhooks</DocInlineCode> before concluding
              the issue is only a background-sync problem.
            </li>
          </ol>
          <DocCallout variant="danger" title="Avoid retry flooding">
            Repeated manual sync attempts are a poor substitute for diagnosis.
            If the same sync path keeps failing, inspect the logs and escalate
            instead of repeatedly retriggering the job.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "supported-webhook-events",
      title: "Supported Webhook Events",
      group: "Reference",
      content: (
        <div className="space-y-4">
          <DocCodeBlock
            language="text"
            code={subscribedWebhookEvents}
            ariaLabel="Square webhook events subscribed by BloomSuite"
          />
          <DocCallout title="Current subscription set">
            BloomSuite currently ensures these 13 Square event types when it
            creates or verifies the webhook subscription. The webhook handler
            also contains an invoice payment path, but that event is not part of
            the current required subscription list in the webhook manager.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "field-mapping-reference",
      title: "Field Mapping Reference",
      group: "Reference",
      content: (
        <DocTable
          headers={["Square Field", "BloomSuite Field", "Notes"]}
          rows={[
            [
              <DocInlineCode>customer.email_address</DocInlineCode>,
              <DocInlineCode>crm_customers.email</DocInlineCode>,
              "Primary customer identifier for batch sync and webhook matching.",
            ],
            [
              <DocInlineCode>customer.given_name</DocInlineCode>,
              <DocInlineCode>crm_customers.first_name</DocInlineCode>,
              "Stored directly when available.",
            ],
            [
              <DocInlineCode>customer.family_name</DocInlineCode>,
              <DocInlineCode>crm_customers.last_name</DocInlineCode>,
              "Stored directly when available.",
            ],
            [
              <DocInlineCode>customer.phone_number</DocInlineCode>,
              <DocInlineCode>crm_customers.phone</DocInlineCode>,
              "Used as a fallback identity match in webhook flows.",
            ],
            [
              <DocInlineCode>customer.id</DocInlineCode>,
              <DocInlineCode>crm_customers.square_customer_id</DocInlineCode>,
              "Used for future Square-specific lookups.",
            ],
            [
              <DocInlineCode>customer.group_ids</DocInlineCode>,
              <>
                <DocInlineCode>crm_customers.tags</DocInlineCode> and{" "}
                <DocInlineCode>crm_customers.square_group_ids</DocInlineCode>
              </>,
              "Group IDs are resolved to tag names when group metadata is available.",
            ],
            [
              <DocInlineCode>preferences.email_unsubscribed</DocInlineCode>,
              <DocInlineCode>crm_customers.email_opt_in</DocInlineCode>,
              "The value is inverted: unsubscribed false becomes opt-in true.",
            ],
            [
              <DocInlineCode>payment.total_money.amount</DocInlineCode>,
              <DocInlineCode>pos_orders.total_amount</DocInlineCode>,
              "Stored as the order or payment amount recorded by the Square handler.",
            ],
            [
              <DocInlineCode>payment.id</DocInlineCode>,
              <DocInlineCode>pos_orders.external_id</DocInlineCode>,
              "Part of the idempotent order key.",
            ],
            [
              <DocInlineCode>payment.created_at</DocInlineCode>,
              <DocInlineCode>pos_orders.order_date</DocInlineCode>,
              "Stored as the event-backed order timestamp.",
            ],
          ]}
        />
      ),
    },
    {
      id: "frequently-asked-questions",
      title: "Frequently Asked Questions",
      group: "Reference",
      content: (
        <div className="space-y-5 text-[15px] leading-7 text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">
              Can I connect multiple Square locations to one BloomSuite site?
            </p>
            <p>
              BloomSuite stores Square connection metadata at the merchant level
              and also records the location ID returned by the current
              connection. Treat the integration as merchant-scoped unless your
              product flow explicitly narrows behavior in a future milestone.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              What happens if I disconnect Square?
            </p>
            <p>
              Disconnecting Square removes the live connection record and stops
              future sync and webhook processing. Existing CRM and order data
              already written into BloomSuite is not documented here as being
              deleted automatically.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Does BloomSuite write data back to Square?
            </p>
            <p>
              The customer, order, webhook, and automation behaviors documented
              on this page are Square-to-BloomSuite flows. If your rollout
              depends on write-back behavior, confirm the current implementation
              with engineering or support before treating it as available.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              Can I use Square and another POS integration at the same time?
            </p>
            <p>
              BloomSuite&apos;s integrations shell supports multiple POS
              providers, and the codebase contains separate detail and
              documentation routes for Square, Clover, and Lightspeed.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              How long does the initial sync take?
            </p>
            <p>
              The current UI shows sync timestamps and synced counts after work
              has completed, but this documentation page does not promise a
              fixed duration. Expect timing to depend on merchant size, webhook
              state, and Square API responsiveness.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
