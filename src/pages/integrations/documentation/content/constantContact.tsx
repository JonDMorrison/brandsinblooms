import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

import { documentationLogoAssets } from "./logoAssets";

const constantContactSeed = getIntegrationSeed("constant-contact");

if (!constantContactSeed) {
  throw new Error("Constant Contact integration seed is missing.");
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
      <table className="w-full min-w-[40rem] border-collapse text-sm">
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

export const constantContactDocumentation: DocContent = {
  integrationName: "Constant Contact",
  integrationSlug: constantContactSeed.slug,
  category: "Marketing Import",
  pageTitle: "Constant Contact Import Guide",
  overview:
    "Import your Constant Contact contact lists, tags, and subscription data into BloomSuite. This integration migrates your contacts so you can continue your email marketing inside BloomSuite without relying on a live two-way sync.",
  readingTimeMinutes: 9,
  lastUpdated: "2026-01-15",
  branding: {
    icon: constantContactSeed.icon,
    logoSrc: documentationLogoAssets["constant-contact"],
    logoAlt: "Constant Contact logo",
  },
  sections: [
    {
      id: "overview",
      title: "Overview",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            Constant Contact is one of BloomSuite&apos;s marketing-import
            providers. Like Mailchimp and Klaviyo, it is documented as a
            one-time or periodic migration path for contacts and list structure,
            not as a continuous CRM synchronization connection.
          </p>
          <p>
            The current detail page reinforces that model with the labels
            <strong> Purpose: Contact Import</strong> and{" "}
            <strong>Live Sync: Not available</strong>. Once the import is
            complete, your Constant Contact account and BloomSuite operate
            independently unless you run another import.
          </p>
        </div>
      ),
    },
    {
      id: "before-you-start",
      title: "Before You Start",
      group: "Getting Started",
      content: (
        <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
          <ul className="list-disc space-y-3 pl-6">
            <li>
              Audit Constant Contact lists and remove hard bounces you do not
              want in BloomSuite.
            </li>
            <li>
              Verify consent and unsubscribe data before the first production
              import.
            </li>
            <li>
              Confirm your BloomSuite sending domain is ready before emailing
              imported contacts.
            </li>
            <li>
              Identify any custom fields that still matter after the migration.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "connecting-constant-contact",
      title: "Connecting Constant Contact",
      group: "Getting Started",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Open the Constant Contact integration page",
                body: (
                  <p>
                    Go to Integrations and open Constant Contact. Use the detail
                    page to confirm connection state and import actions before
                    entering the migration wizard.
                  </p>
                ),
              },
              {
                title: "Click Connect and complete authorization",
                body: (
                  <p>
                    Start the provider connection from BloomSuite and complete
                    the provider authorization flow. When successful, BloomSuite
                    should return with a connected provider state and available
                    import actions.
                  </p>
                ),
              },
              {
                title: "Return to the migration wizard",
                body: (
                  <p>
                    Once connected, use{" "}
                    <DocInlineCode>Open Import Flow</DocInlineCode>
                    or <DocInlineCode>Preview Lists</DocInlineCode> to continue
                    into list selection and import.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "step-1-preview-contact-lists",
      title: "Step 1: Preview Contact Lists",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            Use <DocInlineCode>Preview Lists</DocInlineCode> to fetch Constant
            Contact lists into the migration wizard. The current import detail
            surface tracks discovered lists, and the Constant Contact provider
            capabilities explicitly describe previewing available contact lists
            before import.
          </p>
          <DocCallout title="Segment handling is simpler here">
            In the current migration flow, Constant Contact is normalized
            without list-level segments, so expect list-centric import review
            rather than a combined lists-and-segments experience.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "step-2-select-and-map",
      title: "Step 2: Select and Map",
      group: "Import Process",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            Select the Constant Contact lists you want to import, then review
            how standard contact fields and any custom fields should map into
            BloomSuite.
          </p>
          <DocTable
            headers={["Constant Contact Field", "BloomSuite Field"]}
            rows={[
              [
                <DocInlineCode key="cc-email">email_address</DocInlineCode>,
                <DocInlineCode key="ccf-email">email</DocInlineCode>,
              ],
              [
                <DocInlineCode key="cc-first">first_name</DocInlineCode>,
                <DocInlineCode key="ccf-first">first_name</DocInlineCode>,
              ],
              [
                <DocInlineCode key="cc-last">last_name</DocInlineCode>,
                <DocInlineCode key="ccf-last">last_name</DocInlineCode>,
              ],
              [
                <DocInlineCode key="cc-phone">phone_number</DocInlineCode>,
                <DocInlineCode key="ccf-phone">phone</DocInlineCode>,
              ],
              [
                <DocInlineCode key="cc-company">company_name</DocInlineCode>,
                <DocInlineCode key="ccf-company">company</DocInlineCode>,
              ],
              [
                <DocInlineCode key="cc-optin">
                  permission_to_send
                </DocInlineCode>,
                <DocInlineCode key="ccf-consent">consent_status</DocInlineCode>,
              ],
              [
                "Tags",
                <DocInlineCode key="ccf-tags">
                  crm_customers.tags
                </DocInlineCode>,
              ],
            ]}
          />
        </div>
      ),
    },
    {
      id: "step-3-import-monitor",
      title: "Step 3: Import & Monitor",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            Start the migration with <DocInlineCode>Start Import</DocInlineCode>
            . The import runs through the existing background-friendly progress
            experience, so you can monitor status without treating the process
            as a blocking live-sync job.
          </p>
        </div>
      ),
    },
    {
      id: "after-import",
      title: "After Import",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            After the import completes, verify contact counts, list-derived
            grouping, unsubscribe preservation, and the custom fields you chose
            to map.
          </p>
        </div>
      ),
    },
    {
      id: "contact-fields",
      title: "Contact Fields",
      group: "What Gets Imported",
      content: (
        <DocTable
          headers={["Data", "Imported", "Notes"]}
          rows={[
            ["Email address", "Yes", "Primary contact identifier"],
            ["First and last name", "Yes", ""],
            ["Phone", "Yes", ""],
            ["Company", "Yes", ""],
            [
              "Consent or opt-in status",
              "Yes",
              "Mapped to contact consent state",
            ],
            [
              "Unsubscribe status",
              "Yes",
              "Should remain restrictive after import",
            ],
            ["Custom fields", "Yes", "Requires mapping review"],
          ]}
        />
      ),
    },
    {
      id: "lists-tags",
      title: "Lists & Tags",
      group: "What Gets Imported",
      content: (
        <div className={proseClassName}>
          <p>
            Constant Contact lists and tags are part of the migration surface.
            BloomSuite preserves enough provider structure to let you review and
            continue organizing contacts after import without implying an
            ongoing live integration.
          </p>
        </div>
      ),
    },
    {
      id: "what-does-not-import",
      title: "What Does NOT Import",
      group: "What Gets Imported",
      content: (
        <DocTable
          headers={["Data", "Why"]}
          rows={[
            [
              "Campaign history",
              "Not part of the contact-import surface documented here",
            ],
            [
              "Open and click rates",
              "Aggregate reporting context is outside the CRM migration scope",
            ],
            [
              "Event or survey registrations",
              "Provider-specific artifacts outside the core contact migration path",
            ],
          ]}
        />
      ),
    },
    {
      id: "connection-issues",
      title: "Connection Issues",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            If the provider does not remain connected after authorization,
            resolve that first on the integration detail page before debugging
            the import steps.
          </p>
        </div>
      ),
    },
    {
      id: "import-errors",
      title: "Import Errors",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            Use the current import progress screen and latest import summary to
            narrow the issue to provider validation, list fetch, record import,
            or post-import review.
          </p>
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
            <h3 className="text-base font-semibold text-foreground">
              Will connecting BloomSuite affect my Constant Contact account?
            </h3>
            <p>
              No. The connection is used for importing and does not modify the
              source account.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Can I disconnect Constant Contact after the import is complete?
            </h3>
            <p>
              Yes. Disconnecting removes the stored provider connection, but it
              does not remove contacts that were already imported into
              BloomSuite.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              What happens to unsubscribed contacts?
            </h3>
            <p>
              They should remain unsubscribed or otherwise restricted after the
              migration so they do not become active recipients by accident.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
