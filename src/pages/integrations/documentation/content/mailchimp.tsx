import type { ReactNode } from "react";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocStep } from "@/components/docs/DocStep";
import type { DocContent } from "@/components/docs/types";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";

import { documentationLogoAssets } from "./logoAssets";

const mailchimpSeed = getIntegrationSeed("mailchimp");

if (!mailchimpSeed) {
  throw new Error("Mailchimp integration seed is missing.");
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

export const mailchimpDocumentation: DocContent = {
  integrationName: "Mailchimp",
  integrationSlug: mailchimpSeed.slug,
  category: "Marketing Import",
  pageTitle: "Mailchimp Import Guide",
  overview:
    "Import your Mailchimp contacts, lists, tags, and consent data into BloomSuite in a few steps. This integration is designed for one-time or periodic imports, and BloomSuite becomes your primary email marketing platform once the migration is complete.",
  readingTimeMinutes: 11,
  lastUpdated: "2026-01-15",
  branding: {
    icon: mailchimpSeed.icon,
    logoSrc: documentationLogoAssets.mailchimp,
    logoAlt: "Mailchimp logo",
  },
  sections: [
    {
      id: "overview-what-this-integration-does",
      title: "Overview & What This Integration Does",
      group: "Getting Started",
      content: (
        <div className={proseClassName}>
          <p>
            The Mailchimp integration is a <strong>contact import tool</strong>.
            It connects BloomSuite to your Mailchimp account, lets you preview
            available audiences, and imports contacts into BloomSuite&apos;s CRM
            through the existing migration wizard.
          </p>
          <p>
            This is <strong>not</strong> a two-way live sync. The current app
            labels the connection purpose as <strong>Contact Import</strong> and
            explicitly shows <strong>Live Sync: Not available</strong> on the
            integration detail page. Mailchimp data is imported into BloomSuite;
            changes in BloomSuite are not pushed back to Mailchimp, and
            Mailchimp is not monitored in real time after the import.
          </p>
          <p>
            Typical use case: you have been running email marketing in
            Mailchimp, you are moving to BloomSuite, and you need to carry your
            subscribers, tags, list structure, and consent state into the new
            CRM without starting from zero.
          </p>
          <DocCallout title="Read-only import behavior">
            After completing a Mailchimp import, you can continue running
            Mailchimp campaigns or transition fully to BloomSuite. The import
            path is read-only from BloomSuite&apos;s perspective and does not
            modify data in your Mailchimp account.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "before-you-start-migration-checklist",
      title: "Before You Start: Migration Checklist",
      group: "Getting Started",
      content: (
        <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
          <ul className="list-disc space-y-3 pl-6">
            <li>
              Audit your Mailchimp lists and clean up duplicates, misspellings,
              and audience records you do not want to carry into BloomSuite.
            </li>
            <li>
              Review consent data before import. BloomSuite can preserve status,
              but you remain responsible for the accuracy and legality of that
              consent data.
            </li>
            <li>
              Verify your BloomSuite sending domain before mailing imported
              contacts. Check the Email Infrastructure integration before your
              first production send.
            </li>
            <li>
              Decide how you want imported lists, tags, and groupings to map
              into BloomSuite segments and tags.
            </li>
            <li>
              Export a backup from Mailchimp before the first production import.
            </li>
          </ul>
          <DocCallout variant="warning" title="Respect prior unsubscribes">
            Do not import previously unsubscribed Mailchimp contacts as active
            subscribers in BloomSuite. BloomSuite can preserve unsubscribe
            status, but you should verify that result before sending campaigns.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "connecting-mailchimp",
      title: "Connecting Mailchimp",
      group: "Getting Started",
      content: (
        <div className="space-y-6">
          <StepList
            steps={[
              {
                title: "Open the Mailchimp integration page",
                body: (
                  <p>
                    Go to Integrations and open Mailchimp. The detail page is
                    the best place to confirm the connection state, account
                    details, import purpose, and available import actions.
                  </p>
                ),
              },
              {
                title: "Click Connect",
                body: (
                  <p>
                    Start the provider connection from BloomSuite. The current
                    migration flow tracks Mailchimp as a connected provider and
                    uses that stored connection to power list preview and import
                    steps in the migration wizard.
                  </p>
                ),
              },
              {
                title: "Complete the Mailchimp authorization flow",
                body: (
                  <p>
                    Sign in to Mailchimp, approve BloomSuite access, and wait
                    for the connection callback to return you to the app. When
                    the connection succeeds, the integration detail page should
                    show a connected state and enable actions like{" "}
                    <DocInlineCode>Open Import Flow</DocInlineCode> and{" "}
                    <DocInlineCode>Preview Lists</DocInlineCode>.
                  </p>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      id: "step-1-preview-your-lists",
      title: "Step 1: Preview Your Lists",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            On the Mailchimp integration detail page, use{" "}
            <DocInlineCode>Preview Lists</DocInlineCode> to open the migration
            wizard at the list-selection step. BloomSuite caches provider
            artifacts from prior previews so the detail page can show how many
            lists and segments have already been discovered.
          </p>
          <p>
            Review each audience you plan to import and identify whether the
            migration should cover a whole list or a narrower subset based on
            tags or other list structure.
          </p>
        </div>
      ),
    },
    {
      id: "step-2-select-contacts-to-import",
      title: "Step 2: Select Contacts to Import",
      group: "Import Process",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            Choose the scope of the import before you start processing records.
            The safest production path is usually active subscribers only,
            unless your migration requires CRM visibility into unsubscribed or
            archived contacts.
          </p>
          <DocTable
            headers={["Option", "What it imports"]}
            rows={[
              ["All subscribers", "Contacts with active subscribed status"],
              [
                "All contacts including unsubscribed",
                "All contacts regardless of status, while preserving restrictive consent states",
              ],
              [
                "Tagged contacts only",
                "A filtered subset of contacts based on tags you decide to migrate",
              ],
            ]}
          />
          <DocCallout title="Segment filtering in the Choose step">
            When you select specific segments in the Choose step, only contacts
            from those segments are imported. Contacts in the full list but not
            in your selected segments will not be imported.
          </DocCallout>
          <DocCallout
            variant="warning"
            title="Unsubscribed records remain unsubscribed"
          >
            Importing unsubscribed contacts should preserve their unsubscribe or
            restrictive consent state in BloomSuite. They can exist in the CRM
            without becoming campaign recipients.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "step-3-map-fields",
      title: "Step 3: Map Fields",
      group: "Import Process",
      content: (
        <div className="space-y-5">
          <p className="text-[15px] leading-7 text-muted-foreground">
            BloomSuite&apos;s migration flow is built to preserve core contact
            identity and common marketing metadata. Standard Mailchimp fields
            should map cleanly; custom fields need review before import so you
            can decide whether to map them into an existing BloomSuite field, a
            new custom field, or skip them.
          </p>
          <DocTable
            headers={["Mailchimp Field", "BloomSuite Field"]}
            rows={[
              [
                <DocInlineCode key="email">EMAIL</DocInlineCode>,
                <DocInlineCode key="crm-email">
                  crm_customers.email
                </DocInlineCode>,
              ],
              [
                <DocInlineCode key="fname">FNAME</DocInlineCode>,
                <DocInlineCode key="crm-first">
                  crm_customers.first_name
                </DocInlineCode>,
              ],
              [
                <DocInlineCode key="lname">LNAME</DocInlineCode>,
                <DocInlineCode key="crm-last">
                  crm_customers.last_name
                </DocInlineCode>,
              ],
              [
                <DocInlineCode key="phone">PHONE</DocInlineCode>,
                <DocInlineCode key="crm-phone">
                  crm_customers.phone
                </DocInlineCode>,
              ],
              [
                "Subscription status",
                <DocInlineCode key="crm-consent">
                  crm_customers.consent_status
                </DocInlineCode>,
              ],
              [
                "Unsubscribe date",
                <DocInlineCode key="crm-unsub">
                  crm_customers.unsubscribed_at
                </DocInlineCode>,
              ],
              [
                "Tags",
                <DocInlineCode key="crm-tags">
                  crm_customers.tags
                </DocInlineCode>,
              ],
            ]}
          />
        </div>
      ),
    },
    {
      id: "step-4-import-monitor",
      title: "Step 4: Import & Monitor",
      group: "Import Process",
      content: (
        <div className={proseClassName}>
          <p>
            Use <DocInlineCode>Open Import Flow</DocInlineCode> to review the
            migration steps and then start the import with the existing{" "}
            <DocInlineCode>Start Import</DocInlineCode> action. The current
            import step validates the selected provider and then runs the
            provider-specific import job in the background.
          </p>
          <p>
            The current UI shows real-time progress and explicitly notes that
            background processing is enabled, so the import can continue while
            you navigate away from the page. Expect a longer duration for very
            large audiences.
          </p>
        </div>
      ),
    },
    {
      id: "after-import-what-to-check",
      title: "After Import: What to Check",
      group: "Import Process",
      content: (
        <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
          <ol className="list-decimal space-y-3 pl-6">
            <li>Verify expected contact counts in the BloomSuite CRM.</li>
            <li>
              Confirm Mailchimp tags or list-derived groupings imported
              correctly.
            </li>
            <li>
              Review unsubscribed contacts and confirm restrictive consent
              states were preserved.
            </li>
            <li>
              Set up any follow-up BloomSuite segments that should mirror your
              Mailchimp structure.
            </li>
            <li>
              Send a small internal test campaign before your first production
              send.
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: "contact-fields",
      title: "Contact Fields",
      group: "What Gets Imported",
      content: (
        <DocTable
          headers={["Mailchimp Data", "Imported", "Notes"]}
          rows={[
            ["Email address", "Yes", "Primary identifier"],
            ["First name", "Yes", ""],
            ["Last name", "Yes", ""],
            ["Phone", "Yes", ""],
            ["Subscription status", "Yes", "Mapped to consent status"],
            ["Unsubscribe date", "Yes", "Preserved when available"],
            [
              "Segments",
              "Yes",
              "Imported as BloomSuite CRM segments, with contacts linked",
            ],
            ["Tags", "Yes", "Preserved as tags"],
            [
              "Groups or interests",
              "Yes",
              "Typically carried as tags or audience structure",
            ],
            ["Custom merge fields", "Yes", "Requires field mapping review"],
            ["Signup source", "Yes", "Can be retained as supporting context"],
          ]}
        />
      ),
    },
    {
      id: "tags-groups",
      title: "Tags & Groups",
      group: "What Gets Imported",
      content: (
        <div className={proseClassName}>
          <p>
            Mailchimp list structure, tags, and other audience groupings are
            part of the migration surface BloomSuite is designed to preserve.
            The detail page capabilities explicitly call out previewing
            audiences and preserving list and segment structure for review.
          </p>
        </div>
      ),
    },
    {
      id: "consent-subscription-status",
      title: "Consent & Subscription Status",
      group: "What Gets Imported",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite should preserve Mailchimp subscription state as part of
            the import rather than resetting everyone to an active marketing
            state. Treat any restrictive status as the safer source of truth
            unless you have documented consent to do otherwise.
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
          headers={["Mailchimp Data", "Why it does not import"]}
          rows={[
            [
              "Campaign send history",
              "Not treated as portable CRM migration data in the current import guide",
            ],
            [
              "Open and click rates",
              "Aggregate engagement context does not map cleanly into BloomSuite contact records",
            ],
            [
              "Automation enrollment state",
              "Mailchimp automation context does not translate directly to BloomSuite automations",
            ],
            [
              "Landing pages and forms",
              "Provider-specific assets that are outside the contact-import scope",
            ],
            [
              "Survey-specific responses",
              "Not part of the core contact migration path documented here",
            ],
          ]}
        />
      ),
    },
    {
      id: "preparing-your-mailchimp-lists-before-import",
      title: "Preparing Your Mailchimp Lists Before Import",
      group: "Best Practices",
      content: (
        <div className="space-y-4 text-[15px] leading-7 text-muted-foreground">
          <ol className="list-decimal space-y-3 pl-6">
            <li>
              Remove hard bounces before import so poor-quality addresses do not
              reduce deliverability.
            </li>
            <li>
              Normalize inconsistent tag names before importing, because tags
              carry over as meaningful CRM structure.
            </li>
            <li>
              Merge duplicates in Mailchimp where possible, especially if the
              same person appears with multiple records.
            </li>
            <li>
              Review spam reports and archive contacts you should not continue
              mailing.
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: "handling-duplicate-contacts",
      title: "Handling Duplicate Contacts",
      group: "Best Practices",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite should treat email address as the primary deduplication
            key during marketing imports. In practice that means re-imports are
            expected to update matching contacts, merge imported tags or list
            structure, and preserve the more restrictive consent state when two
            records conflict.
          </p>
        </div>
      ),
    },
    {
      id: "managing-consent-compliance",
      title: "Managing Consent Compliance",
      group: "Best Practices",
      content: (
        <div className={proseClassName}>
          <p>
            BloomSuite preserves the imported contact state, but compliance
            remains your responsibility. Treat prior unsubscribes, suppressed
            records, and region-specific consent requirements as hard rules for
            the migration rather than as optional cleanup tasks.
          </p>
          <DocCallout
            variant="warning"
            title="Legal risk follows the contact state, not the platform"
          >
            Sending to contacts who unsubscribed in Mailchimp can create the
            same compliance risk after migration. Always verify the imported
            consent state before your first campaign.
          </DocCallout>
        </div>
      ),
    },
    {
      id: "connection-errors",
      title: "Connection Errors",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            If Mailchimp does not show as connected after authorization, return
            to the integration detail page and confirm the provider connection
            completed successfully before debugging the migration flow itself.
          </p>
        </div>
      ),
    },
    {
      id: "import-failures",
      title: "Import Failures",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            Use the import progress UI and the latest import summary on the
            integration detail page to determine whether the failure is global,
            record-specific, or caused by validation before the import starts.
          </p>
        </div>
      ),
    },
    {
      id: "missing-contacts",
      title: "Missing Contacts",
      group: "Troubleshooting",
      content: (
        <div className={proseClassName}>
          <p>
            If expected contacts are missing, check whether you filtered by tag,
            excluded unsubscribed contacts, or selected only a subset of
            audiences during the choose step.
          </p>
        </div>
      ),
    },
    {
      id: "field-mapping-reference",
      title: "Field Mapping Reference",
      group: "Reference",
      content: (
        <DocTable
          headers={[
            "Mailchimp Merge Tag",
            "Mailchimp Label",
            "BloomSuite Field",
            "Auto-mapped",
          ]}
          rows={[
            [
              <DocInlineCode key="f-email">EMAIL</DocInlineCode>,
              "Email Address",
              <DocInlineCode key="bf-email">email</DocInlineCode>,
              "Yes",
            ],
            [
              <DocInlineCode key="f-fname">FNAME</DocInlineCode>,
              "First Name",
              <DocInlineCode key="bf-first">first_name</DocInlineCode>,
              "Yes",
            ],
            [
              <DocInlineCode key="f-lname">LNAME</DocInlineCode>,
              "Last Name",
              <DocInlineCode key="bf-last">last_name</DocInlineCode>,
              "Yes",
            ],
            [
              <DocInlineCode key="f-phone">PHONE</DocInlineCode>,
              "Phone Number",
              <DocInlineCode key="bf-phone">phone</DocInlineCode>,
              "Yes",
            ],
            [
              <DocInlineCode key="f-address">ADDRESS</DocInlineCode>,
              "Address",
              "address custom field",
              "Manual",
            ],
            [
              <DocInlineCode key="f-birthday">BIRTHDAY</DocInlineCode>,
              "Birthday",
              "birthday custom field",
              "Manual",
            ],
          ]}
        />
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
              Will importing from Mailchimp affect my Mailchimp account?
            </h3>
            <p>No. The import path is read-only from BloomSuite&apos;s side.</p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Can I run the import again later?
            </h3>
            <p>
              Yes. Mailchimp is documented here as a one-time or periodic import
              tool, so repeat imports are part of the expected workflow when you
              need to refresh data manually.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Does BloomSuite keep syncing with Mailchimp after import?
            </h3>
            <p>
              No. The integration detail page explicitly marks live sync as not
              available for this provider.
            </p>
          </div>
        </div>
      ),
    },
  ],
};
